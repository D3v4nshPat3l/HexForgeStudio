/** Small, local-only landing effects. All decorative motion stops for reduced-motion users. */
export function startLandingMotion(root: HTMLElement): () => void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = root.querySelector<HTMLCanvasElement>("#hero-field");
  const context = canvas?.getContext("2d");
  const menuButton = root.querySelector<HTMLButtonElement>(".mobile-menu");
  const navigation = root.querySelector<HTMLElement>("#primary-nav");
  const cleanups: Array<() => void> = [];

  if (menuButton && navigation) {
    const closeMenu = (): void => {
      menuButton.setAttribute("aria-expanded", "false");
      navigation.classList.remove("is-open");
    };
    const toggleMenu = (): void => {
      const open = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(open));
      navigation.classList.toggle("is-open", open);
    };
    menuButton.addEventListener("click", toggleMenu);
    navigation.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("a")) closeMenu();
    });
    const escape = (event: KeyboardEvent): void => { if (event.key === "Escape") closeMenu(); };
    document.addEventListener("keydown", escape);
    cleanups.push(() => { menuButton.removeEventListener("click", toggleMenu); document.removeEventListener("keydown", escape); });
  }

  const revealItems = [...root.querySelectorAll<HTMLElement>(".reveal")];
  let observer: IntersectionObserver | undefined;
  if (!reduced.matches && "IntersectionObserver" in window) {
    root.classList.add("motion-ready");
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer?.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    revealItems.forEach((item) => observer?.observe(item));
    cleanups.push(() => { observer?.disconnect(); root.classList.remove("motion-ready"); });
  }

  if (!canvas || !context) return () => cleanups.forEach((cleanup) => cleanup());
  const colors = { ink: "rgba(73,82,66,.38)", oxide: "rgba(184,67,34,.42)" };
  const particles = Array.from({ length: 44 }, (_, index) => ({
    x: Math.random(), y: Math.random(),
    drift: (Math.random() - .5) * .000035,
    speed: .00002 + Math.random() * .00005,
    size: index % 7 === 0 ? 2 : 1.1,
    accent: index % 9 === 0
  }));
  let width = 0;
  let height = 0;
  let frame = 0;
  let previous = 0;
  const resize = (): void => {
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    if (reduced.matches) draw(0, true);
  };
  const draw = (time: number, stationary = false): void => {
    context.clearRect(0, 0, width, height);
    const points = particles.map((particle) => ({
      x: particle.x * width,
      y: ((particle.y - (stationary ? 0 : time * particle.speed)) % 1 + 1) % 1 * height
    }));
    points.forEach((point, index) => {
      for (let nextIndex = index + 1; nextIndex < points.length; nextIndex += 1) {
        const next = points[nextIndex]!;
        const distance = Math.hypot(next.x - point.x, next.y - point.y);
        if (distance < 112) {
          context.strokeStyle = `rgba(91,99,79,${(1 - distance / 112) * .12})`;
          context.lineWidth = .65;
          context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(next.x, next.y); context.stroke();
        }
      }
      const particle = particles[index]!;
      context.fillStyle = particle.accent ? colors.oxide : colors.ink;
      context.beginPath(); context.arc(point.x, point.y, particle.size, 0, Math.PI * 2); context.fill();
      if (!stationary) particle.x = (particle.x + particle.drift + 1) % 1;
    });
  };
  const animate = (time: number): void => {
    if (document.hidden || reduced.matches) return;
    frame = requestAnimationFrame(animate);
    if (time - previous < 40) return;
    previous = time;
    draw(time);
  };
  const start = (): void => {
    cancelAnimationFrame(frame);
    if (document.hidden || reduced.matches) draw(0, true);
    else frame = requestAnimationFrame(animate);
  };
  const visibility = (): void => start();
  document.addEventListener("visibilitychange", visibility);
  reduced.addEventListener("change", start);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  start();
  cleanups.push(() => {
    cancelAnimationFrame(frame);
    document.removeEventListener("visibilitychange", visibility);
    reduced.removeEventListener("change", start);
    resizeObserver.disconnect();
  });
  return () => cleanups.forEach((cleanup) => cleanup());
}
