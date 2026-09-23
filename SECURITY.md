# Security

When Can We is a static page. It does not have an account system, a server, or a database.

The plan is stored in your browser’s `localStorage` and, when you share it, in the URL hash. A hash is not sent to the web server with the page request. Anyone with the link can read and change the copy they open. Do not put secrets, home addresses, or phone numbers in the name fields.

The page sends no analytics. Its Content-Security-Policy does not allow network requests.

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/macodev00/Idk-yet-let-grok-decide/security/advisories/new) for this repository.

Bugs that are not security issues belong in the public issue tracker.
