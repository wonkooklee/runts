# Security Policy

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through [GitHub private vulnerability reporting](https://github.com/wonkooklee/runts/security/advisories/new) with steps to reproduce and the affected version.

You can expect an initial response within a week. If the report is confirmed, a fix will be released and the advisory published with credit to you unless you prefer to stay anonymous.

## Scope

RunTS executes the code you type with full Node.js access to your user account, the same as running a script in a terminal. Running untrusted code in RunTS is therefore not a vulnerability in itself. Reports about the app escaping that model, such as a web page or a file opened in RunTS executing code without your action, are in scope.
