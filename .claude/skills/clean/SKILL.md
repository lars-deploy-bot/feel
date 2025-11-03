---
name: Clean Code
description: Clean up the code and make it PR ready.
---

do not do any git commands.

of all the code that was just written, you clean up. you document, make sure the variables are all clear and unambiguous, remove unused scripts, or markdown files that are no longer necessary. the code has to be understandable for an outsider, and not use any's or as's. if unclear what files have been edited, you must ask the user to provide it. you must only work in the files you edited and the code that was just edited. you make it PR ready. you check all your edits and remove any .md files that are at the root of the project.

code needs to speak for itself, and comments (especially multi-block comments are ok, but need to be minimal.) code should speak for itself.

look and revise at yourself. which files have you editted? are the new files placed at the right place and not just put somewhere at the top of a directory? there should be no index.ts files, except in the shared folder. also: do the file names make sense? didn't you put bullshit somewhere? did you see any zod files that weren't put in the right zod folder? (contracts, shared folder or in the /lib/schemas?)