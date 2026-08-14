import type { CapabilityHit, ExtractedString, Severity } from "../types";

/**
 * Capability tagging.
 *
 * Extracted strings are matched against a curated indicator table covering the
 * behaviours an analyst usually wants flagged first: anti-analysis, injection,
 * persistence, credential access, network staging, and destructive actions.
 *
 * A hit means the literal appears in the file. It does not mean the code path is
 * reachable, that the import is real, or that the behaviour occurs at runtime.
 */

interface IndicatorDefinition {
  category: string;
  severity: Severity;
  description: string;
  indicators: string[];
}

const INDICATOR_TABLE: IndicatorDefinition[] = [
  {
    category: "Anti-debugging",
    severity: "high",
    description: "Detects an attached debugger, which is normally used to frustrate analysis.",
    indicators: [
      "IsDebuggerPresent", "CheckRemoteDebuggerPresent", "NtQueryInformationProcess", "OutputDebugStringA",
      "OutputDebugStringW", "DebugActiveProcess", "NtSetInformationThread", "ThreadHideFromDebugger",
      "ZwQueryInformationProcess", "DbgUiRemoteBreakin", "DbgBreakPoint", "RtlQueryProcessHeapInformation",
      "ptrace", "PT_DENY_ATTACH", "NtGlobalFlag", "ProcessDebugPort", "ProcessDebugFlags", "ProcessDebugObjectHandle"
    ]
  },
  {
    category: "Virtualization / sandbox evasion",
    severity: "high",
    description: "Fingerprints a virtual machine or sandbox so the sample can change behaviour under analysis.",
    indicators: [
      "VMware", "VBoxService", "VBoxTray", "VirtualBox", "vboxguest", "VBoxGuest", "QEMU", "qemu-ga",
      "Xen Source", "xenservice", "SbieDll", "SbieDrv", "Sandboxie", "cuckoomon", "dbghelp.dll",
      "wine_get_unix_file_name", "VMCI", "vmmouse", "vmtoolsd", "prl_cc", "SharedFolders", "HARDWARE\\ACPI\\DSDT\\VBOX__",
      "SYSTEM\\CurrentControlSet\\Services\\VBoxSF", "GetSystemFirmwareTable", "SystemFirmwareTable"
    ]
  },
  {
    category: "Timing / execution stalling",
    severity: "medium",
    description: "Delays or times execution, a common way to outlast an automated sandbox run.",
    indicators: ["QueryPerformanceCounter", "GetTickCount64", "rdtsc", "NtDelayExecution", "SleepEx", "timeGetTime", "WaitForSingleObject"]
  },
  {
    category: "Code injection",
    severity: "critical",
    description: "Writes to or executes code inside another process.",
    indicators: [
      "VirtualAllocEx", "WriteProcessMemory", "CreateRemoteThread", "CreateRemoteThreadEx", "NtCreateThreadEx",
      "RtlCreateUserThread", "QueueUserAPC", "NtQueueApcThread", "SetThreadContext", "NtUnmapViewOfSection",
      "NtMapViewOfSection", "ZwMapViewOfSection", "SetWindowsHookEx", "LoadLibraryA", "LdrLoadDll",
      "GetProcAddress", "NtWriteVirtualMemory", "process_vm_writev", "mprotect", "dlopen", "task_for_pid"
    ]
  },
  {
    category: "Privilege escalation",
    severity: "high",
    description: "Adjusts tokens or impersonates other security contexts.",
    indicators: [
      "AdjustTokenPrivileges", "SeDebugPrivilege", "SeShutdownPrivilege", "SeTakeOwnershipPrivilege",
      "ImpersonateLoggedOnUser", "DuplicateTokenEx", "LogonUserA", "LogonUserW", "OpenProcessToken",
      "setuid", "seteuid", "CVE-", "sudoers"
    ]
  },
  {
    category: "Persistence",
    severity: "high",
    description: "Arranges for code to run again after reboot or logon.",
    indicators: [
      "CurrentVersion\\Run", "CurrentVersion\\RunOnce", "CurrentVersion\\Winlogon", "Image File Execution Options",
      "AppInit_DLLs", "schtasks", "ITaskService", "TaskScheduler", "CreateServiceA", "CreateServiceW",
      "StartServiceCtrlDispatcher", "OpenSCManager", "crontab", "/etc/rc.local", "LaunchAgents", "LaunchDaemons",
      "systemd/system", "\\Startup\\", "ShellExecuteA", "SetValueEx", "RegSetValueEx"
    ]
  },
  {
    category: "Credential access",
    severity: "critical",
    description: "Reads stored secrets, browser credential stores, or in-memory authentication material.",
    indicators: [
      "CredEnumerateA", "CredReadA", "CryptUnprotectData", "LsaEnumerateLogonSessions", "SamIConnect",
      "lsass.exe", "MiniDumpWriteDump", "vaultcli", "Login Data", "logins.json", "key3.db", "key4.db",
      "signons.sqlite", "wallet.dat", "/etc/shadow", "id_rsa", "\\.ssh\\", "Keychain", "NetworkService",
      "SECURITY\\Policy\\Secrets", "SAM\\Domains\\Account"
    ]
  },
  {
    category: "Keylogging / surveillance",
    severity: "critical",
    description: "Captures keystrokes, the screen, the clipboard, or audio input.",
    indicators: [
      "GetAsyncKeyState", "GetKeyboardState", "GetForegroundWindow", "RegisterRawInputDevices",
      "SetWindowsHookExA", "SetWindowsHookExW", "WH_KEYBOARD_LL", "BitBlt", "GetDC", "CreateCompatibleBitmap",
      "OpenClipboard", "GetClipboardData", "waveInOpen", "capCreateCaptureWindow", "XGrabKeyboard", "CGEventTap"
    ]
  },
  {
    category: "Network / command and control",
    severity: "medium",
    description: "Opens outbound network connections or downloads additional payloads.",
    indicators: [
      "InternetOpenA", "InternetOpenUrlA", "InternetReadFile", "HttpSendRequestA", "WinHttpOpen",
      "WinHttpConnect", "WinHttpSendRequest", "URLDownloadToFileA", "URLDownloadToFileW", "WSASocketA",
      "WSAStartup", "connect", "recv", "send", "gethostbyname", "getaddrinfo", "DnsQuery_A",
      "socket", "curl_easy_init", "libcurl", "User-Agent:", "Content-Type: application/octet-stream"
    ]
  },
  {
    category: "Cryptography",
    severity: "medium",
    description: "Uses cryptographic primitives, which may protect configuration or encrypt victim data.",
    indicators: [
      "CryptAcquireContext", "CryptEncrypt", "CryptDecrypt", "CryptGenKey", "CryptImportKey", "CryptDeriveKey",
      "BCryptEncrypt", "BCryptGenerateSymmetricKey", "BCryptGenRandom", "CryptGenRandom", "AES_set_encrypt_key",
      "EVP_EncryptInit", "RSA_public_encrypt", "libsodium", "ChaCha20", "Salsa20"
    ]
  },
  {
    category: "Destructive / ransomware",
    severity: "critical",
    description: "Deletes recovery data or encrypts user files — behaviour characteristic of ransomware and wipers.",
    indicators: [
      "vssadmin", "Delete Shadows", "wbadmin", "bcdedit", "recoveryenabled", "bootstatuspolicy",
      "cipher.exe /w", "SHFileOperation", "DeviceIoControl", "IOCTL_DISK_DELETE_DRIVE_LAYOUT",
      "YOUR FILES HAVE BEEN ENCRYPTED", "READ_ME", "DECRYPT_INSTRUCTION", "how_to_decrypt", ".onion",
      "shred -", "dd if=/dev/zero", "mkfs."
    ]
  },
  {
    category: "Discovery / reconnaissance",
    severity: "low",
    description: "Enumerates the host, its processes, or the surrounding network.",
    indicators: [
      "CreateToolhelp32Snapshot", "Process32First", "Process32Next", "EnumProcesses", "GetComputerNameA",
      "GetUserNameA", "GetVolumeInformationA", "NetUserEnum", "NetWkstaGetInfo", "WNetEnumResource",
      "GetAdaptersInfo", "systeminfo", "ipconfig", "whoami", "netstat", "tasklist", "arp -a", "uname -a"
    ]
  },
  {
    category: "Defence evasion",
    severity: "high",
    description: "Interferes with logging, security products, or file forensics.",
    indicators: [
      "AmsiScanBuffer", "amsi.dll", "EtwEventWrite", "EtwpEventWriteFull", "NtTraceEvent",
      "MpCmdRun", "MsMpEng", "Windows Defender", "netsh advfirewall", "wevtutil", "ClearEventLog",
      "SetFileTime", "NtSetInformationFile", "ZoneIdentifier", "MpPreference", "DisableRealtimeMonitoring"
    ]
  },
  {
    category: "Scripting / interpreter staging",
    severity: "high",
    description: "Embeds or launches script content, frequently used to stage a second payload.",
    indicators: [
      "powershell", "pwsh.exe", "FromBase64String", "IEX(", "Invoke-Expression", "DownloadString",
      "System.Reflection.Assembly", "Add-Type", "wscript.shell", "ActiveXObject", "eval(", "document.write",
      "<script", "cscript.exe", "mshta", "vbscript:", "javascript:", "exec(", "os.system", "subprocess.Popen"
    ]
  }
];

/** Case-insensitive plain substring search that avoids building a regex per indicator. */
function findAll(haystack: string, needle: string, limit: number): number[] {
  const positions: number[] = [];
  let index = haystack.indexOf(needle);
  while (index >= 0 && positions.length < limit) {
    positions.push(index);
    index = haystack.indexOf(needle, index + 1);
  }
  return positions;
}

export function detectCapabilities(strings: ExtractedString[], maxHits = 1500): CapabilityHit[] {
  const hits: CapabilityHit[] = [];
  const seen = new Set<string>();

  for (const item of strings) {
    if (item.value.length < 3) continue;
    const haystack = item.value.toLowerCase();
    const scale = item.encoding === "UTF-16LE" || item.encoding === "UTF-16BE" ? 2 : 1;

    for (const definition of INDICATOR_TABLE) {
      for (const indicator of definition.indicators) {
        const lowered = indicator.toLowerCase();
        if (!haystack.includes(lowered)) continue;
        for (const position of findAll(haystack, lowered, 4)) {
          const offset = item.offset + Math.min(item.byteLength, position * scale);
          const key = `${definition.category}:${indicator}:${offset}`;
          if (seen.has(key)) continue;
          if (hits.length >= maxHits) return sortHits(hits);
          seen.add(key);
          hits.push({ category: definition.category, indicator, offset, severity: definition.severity, description: definition.description });
        }
      }
    }
  }
  return sortHits(hits);
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function sortHits(hits: CapabilityHit[]): CapabilityHit[] {
  return hits.sort((left, right) => SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] || left.category.localeCompare(right.category) || left.offset - right.offset);
}

/** Distinct categories present, ordered by the highest severity seen in each. */
export function summarizeCapabilities(hits: CapabilityHit[]): Array<{ category: string; count: number; severity: Severity }> {
  const grouped = new Map<string, { count: number; severity: Severity }>();
  for (const hit of hits) {
    const existing = grouped.get(hit.category);
    if (!existing) grouped.set(hit.category, { count: 1, severity: hit.severity });
    else {
      existing.count += 1;
      if (SEVERITY_RANK[hit.severity] < SEVERITY_RANK[existing.severity]) existing.severity = hit.severity;
    }
  }
  return [...grouped.entries()]
    .map(([category, value]) => ({ category, ...value }))
    .sort((left, right) => SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] || right.count - left.count);
}
