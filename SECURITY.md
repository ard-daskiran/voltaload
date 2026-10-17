# Security Policy

## Supported versions

Only the latest version on the `main` branch receives security fixes.

## Reporting a vulnerability

Please don't report security problems in public issues.

Report them privately instead: open the **Security** tab of this repository
and click **Report a vulnerability**, or use
[this link](https://github.com/ard-daskiran/voltaload/security/advisories/new).

Please include:

- what the problem is and what an attacker could do with it
- steps to reproduce it
- the commit you tested, your operating system and Node.js version

I'll get back to you as soon as I can.

## Scope

Volta is a development tool that runs on your own computer. These are
intended behavior, not vulnerabilities:

- Volta sends requests to the address you enter. This is its purpose, and it
  is limited to local and private network addresses.
- TLS certificates of the tested server are not verified, so local HTTPS
  servers with self-signed certificates can be tested.
- Changes you make to Volta's own code or settings, for example removing the
  address check, are your responsibility.

Examples of what is in scope, using Volta as published:

- making Volta send requests to a public address
- reaching the Volta interface from another computer or from another website
  open in your browser
- anything that lets a test target run code or read files through Volta
