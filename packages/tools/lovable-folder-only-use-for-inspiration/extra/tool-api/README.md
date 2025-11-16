# Tool API Reference

## 31 Tools Available to Alive AI

### File Operations (7)
- `alive-view(file_path, lines?)` - Read file contents
- `alive-write(file_path, content)` - Create/overwrite file
- `alive-line-replace(file, search, first_line, last_line, replace)` - Edit specific lines
- `alive-search-files(query, include_pattern, exclude_pattern?)` - Regex search
- `alive-delete(file_path)` - Remove file
- `alive-rename(original, new)` - Rename file
- `alive-copy(source, destination)` - Copy file

### Backend Integration (6)
<!-- SUPABASE DISABLED: - `supabase--enable()` - Enable Alive Cloud -->
- `secrets--add_secret(secret_names[])` - Add environment variables
- `secrets--update_secret(secret_names[])` - Update secrets
- `secrets--delete_secret(secret_names[])` - Delete secrets
- `stripe--enable_stripe()` - Stripe integration
- `shopify--enable_shopify()` - Shopify integration

### Debugging (4)
- `alive-read-console-logs(search?)` - Browser console output
- `alive-read-network-requests(search?)` - Network activity
- `project_debug--sandbox-screenshot(path)` - UI capture
- `project_debug--sleep(seconds)` - Wait for async operations

### Security (4)
- `security--run_security_scan()` - Comprehensive audit
- `security--get_security_scan_results(force)` - Get findings
- `security--get_table_schema()` - Database schema
- `security--manage_security_finding(operations[])` - Manage findings

### External Resources (4)
- `websearch--web_search(query, numResults?, category?)` - Google search
- `websearch--web_code_search(query, tokensNum?)` - Technical docs search
- `alive-fetch-website(url, formats)` - Download webpage
- `alive-download-to-repo(source_url, target_path)` - Download file

### Dependencies (2)
- `alive-add-dependency(package)` - npm install
- `alive-remove-dependency(package)` - npm uninstall

### Image Generation (2)
- `imagegen--generate_image(prompt, target_path, width, height, model?)` - Generate images
- `imagegen--edit_image(image_paths[], prompt, target_path)` - Edit/merge images

### Document Parsing (1)
- `document--parse_document(file_path)` - Extract content from PDFs, Office docs, audio

### Analytics (1)
- `analytics--read_project_analytics(startdate, enddate, granularity)` - Usage data

See `/workflows/` for how these tools are used in decision trees.
