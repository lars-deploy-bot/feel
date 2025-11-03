# Tool Workflow: Performance Optimization

## Scenario
User requests: "My app is slow" or "Optimize performance" or "Reduce load time" or "Why is this lagging?"

## Agent Capabilities
- Code search (lov-search-files)
- File viewing (lov-view)
- Code modification (lov-line-replace, lov-write)
- Console log analysis (lov-read-console-logs)
- Network request analysis (lov-read-network-requests)
- Screenshot capture (project_debug--sandbox-screenshot)
- Dependency management (lov-add-dependency)
- Web search (websearch--web_code_search)

## Decision Tree

```
START: User reports performance issue
│
├─→ DIAGNOSIS PHASE:
│   ├─→ Gather performance data:
│   │   ├─→ lov-read-console-logs(search="slow|performance|warning")
│   │   ├─→ lov-read-network-requests(search="") // All requests
│   │   └─→ project_debug--sandbox-screenshot(path="/slow-page")
│   │
│   ├─→ Analyze console logs:
│   │   ├─→ React warnings (missing keys, unnecessary re-renders)
│   │   ├─→ Bundle size warnings
│   │   ├─→ Memory leaks
│   │   └─→ Slow function executions
│   │
│   ├─→ Analyze network requests:
│   │   ├─→ Large file downloads (>500KB)
│   │   ├─→ Slow API responses (>1s)
│   │   ├─→ Too many requests (N+1 queries)
│   │   ├─→ Unoptimized images
│   │   └─→ Blocking resources
│   │
│   └─→ Identify bottleneck category:
│       ├─→ Frontend rendering (React re-renders, large component trees)
│       ├─→ Network/API (slow queries, large payloads, N+1 problems)
│       ├─→ Bundle size (too many dependencies, no code splitting)
│       ├─→ Images/Assets (unoptimized, wrong format, no lazy loading)
│       └─→ State management (unnecessary re-renders, context hell)
│
├─→ OPTIMIZATION STRATEGY:
│   │
│   ├─→ IF FRONTEND RENDERING ISSUE:
│   │   │
│   │   ├─→ Search for performance anti-patterns:
│   │   │   └─→ lov-search-files(query="useEffect\\(|useState\\(|useContext\\(", include_pattern="src/**/*.tsx")
│   │   │
│   │   ├─→ Common issues to fix:
│   │   │   ├─→ Missing React.memo for expensive components
│   │   │   ├─→ Missing useCallback for functions passed as props
│   │   │   ├─→ Missing useMemo for expensive calculations
│   │   │   ├─→ Unnecessary context re-renders
│   │   │   └─→ Large lists without virtualization
│   │   │
│   │   └─→ Apply fixes:
│   │       ├─→ Wrap expensive components: React.memo(Component)
│   │       ├─→ Memoize callbacks: useCallback(fn, deps)
│   │       ├─→ Memoize values: useMemo(() => expensiveCalc(), deps)
│   │       ├─→ Split context: Multiple small contexts instead of one large
│   │       └─→ Add virtualization: @tanstack/react-virtual for long lists
│   │
│   ├─→ IF NETWORK/API ISSUE:
│   │   │
│   │   ├─→ Analyze query patterns:
<!-- SUPABASE DISABLED: │   │   │   └─→ lov-search-files(query="supabase\\.from|supabase\\.rpc", include_pattern="src/**") -->
│   │   │
│   │   ├─→ Common issues to fix:
│   │   │   ├─→ N+1 queries (fetching in loops)
│   │   │   ├─→ Overfetching (selecting all columns when only need few)
│   │   │   ├─→ Missing indexes on database
│   │   │   ├─→ No request batching
│   │   │   └─→ No caching strategy
│   │   │
│   │   └─→ Apply fixes:
│   │       ├─→ Batch queries: Single query with joins instead of loops
│   │       ├─→ Limit columns: .select('id, name') instead of .select('*')
│   │       ├─→ Add pagination: .range(0, 49) for large datasets
│   │       ├─→ Add indexes: Provide SQL for user to create indexes
│   │       └─→ Enable React Query caching: staleTime, cacheTime
│   │
│   ├─→ IF BUNDLE SIZE ISSUE:
│   │   │
│   │   ├─→ Identify heavy dependencies:
│   │   │   └─→ lov-search-files(query="^import .* from", include_pattern="src/**")
│   │   │
│   │   ├─→ Common issues to fix:
│   │   │   ├─→ No code splitting (all code in one bundle)
│   │   │   ├─→ Importing entire libraries (import _ from 'lodash')
│   │   │   ├─→ Duplicate dependencies
│   │   │   └─→ Unused imports
│   │   │
│   │   └─→ Apply fixes:
│   │       ├─→ Add lazy loading: React.lazy(() => import('./Component'))
│   │       ├─→ Use tree-shakeable imports: import { debounce } from 'lodash-es'
│   │       ├─→ Add dynamic imports for routes
│   │       └─→ Remove unused dependencies
│   │
│   ├─→ IF IMAGES/ASSETS ISSUE:
│   │   │
│   │   ├─→ Find all image usage:
│   │   │   └─→ lov-search-files(query="<img|<Image|backgroundImage", include_pattern="src/**")
│   │   │
│   │   ├─→ Common issues to fix:
│   │   │   ├─→ Large unoptimized images (PNGs instead of WebP)
│   │   │   ├─→ No lazy loading for images
│   │   │   ├─→ Missing responsive images (no srcset)
│   │   │   ├─→ Loading images above the fold eagerly
│   │   │   └─→ No image compression
│   │   │
│   │   └─→ Apply fixes:
│   │       ├─→ Add lazy loading: loading="lazy" attribute
│   │       ├─→ Use WebP format: Convert PNGs to WebP
│   │       ├─→ Add responsive images: srcset with multiple sizes
│   │       ├─→ Priority loading: fetchpriority="high" for hero images
│   │       └─→ Use Next.js Image component (if applicable)
│   │
│   └─→ IF STATE MANAGEMENT ISSUE:
│       │
│       ├─→ Find context usage:
│       │   └─→ lov-search-files(query="createContext|useContext", include_pattern="src/**")
│       │
│       ├─→ Common issues to fix:
│       │   ├─→ Single large context causing global re-renders
│       │   ├─→ Passing unstable values to context
│       │   ├─→ Context value not memoized
│       │   └─→ Too many context consumers
│       │
│       └─→ Apply fixes:
│           ├─→ Split into smaller contexts by domain
│           ├─→ Memoize context values: useMemo(() => ({ state, actions }), [deps])
│           ├─→ Use context selectors (with use-context-selector)
│           └─→ Consider Zustand/Jotai for complex state
│
└─→ VERIFICATION:
    ├─→ Test changes with debugging tools:
    │   ├─→ lov-read-console-logs() // Check for new warnings
    │   ├─→ lov-read-network-requests() // Verify reduced payload
    │   └─→ project_debug--sandbox-screenshot() // Visual check
    │
    └─→ Provide performance report:
        ├─→ Before/after metrics
        ├─→ What was optimized
        ├─→ Expected improvement
        └─→ Further recommendations
```

## Tool Sequences

### Sequence 1: React Re-render Optimization
Request: "My component re-renders too much"

```
1. Identify the component:
   lov-view(src/components/SlowComponent.tsx)

2. Search for performance anti-patterns:
   lov-search-files(query="useContext|props\\.", include_pattern="src/components/SlowComponent.tsx")

3. Analyze issues:
   - Functions recreated on every render (not useCallback)
   - Values recalculated on every render (not useMemo)
   - Context causing unnecessary re-renders
   - Missing React.memo for pure components

4. Apply optimizations (parallel):
   lov-line-replace(src/components/SlowComponent.tsx, add_memo) ||
   lov-line-replace(src/components/SlowComponent.tsx, add_useCallback) ||
   lov-line-replace(src/components/SlowComponent.tsx, add_useMemo)

   Example fixes:
   ```typescript
   // ❌ BEFORE
   function SlowComponent({ data, onUpdate }) {
     const filteredData = data.filter(item => item.active);
     const handleClick = () => onUpdate(data);
     
     return <ExpensiveChild data={filteredData} onClick={handleClick} />;
   }
   
   // ✅ AFTER
   const SlowComponent = React.memo(({ data, onUpdate }) => {
     const filteredData = useMemo(
       () => data.filter(item => item.active),
       [data]
     );
     
     const handleClick = useCallback(
       () => onUpdate(data),
       [data, onUpdate]
     );
     
     return <ExpensiveChild data={filteredData} onClick={handleClick} />;
   });
   ```

5. Verify with console logs:
   lov-read-console-logs()
```

### Sequence 2: Database Query Optimization
Request: "Database queries are slow"

```
1. Analyze network requests:
   lov-read-network-requests()
   
2. Identify slow queries (>500ms):
   - Note which tables are being queried
   - Check if N+1 problem exists (many small queries instead of one join)
   - Check if selecting unnecessary columns

3. Search for query patterns:
<!-- SUPABASE DISABLED:    lov-search-files(query="supabase\\.from|.select\\(", include_pattern="src/**") -->

4. Optimize queries:
   a. N+1 problem fix:
      ```typescript
      // ❌ N+1 PROBLEM
<!-- SUPABASE DISABLED:       const posts = await supabase.from('posts').select('*'); -->
      for (const post of posts.data) {
<!-- SUPABASE DISABLED:         const author = await supabase.from('authors').select('*').eq('id', post.author_id); -->
      }
      
      // ✅ SINGLE QUERY WITH JOIN
<!-- SUPABASE DISABLED:       const posts = await supabase -->
        .from('posts')
        .select(`
          *,
          author:authors(id, name, avatar)
        `);
      ```
   
   b. Overfetching fix:
      ```typescript
      // ❌ SELECTING ALL COLUMNS
      .select('*')
      
      // ✅ ONLY NEEDED COLUMNS
      .select('id, title, created_at')
      ```
   
   c. Add pagination:
      ```typescript
      // ❌ LOADING ALL ROWS
      .select('*')
      
      // ✅ PAGINATED
      .select('*')
      .range(0, 49) // First 50 items
      ```

5. Update code:
   lov-line-replace(src/hooks/usePosts.ts, optimize_query)

6. Provide SQL for indexes:
   ```sql
   -- Add indexes for frequently queried columns
   CREATE INDEX idx_posts_author_id ON posts(author_id);
   CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
   
   -- Add composite index for common query patterns
   CREATE INDEX idx_posts_author_status ON posts(author_id, status);
   ```

7. Verify improvement:
   lov-read-network-requests() // Check response times
```

### Sequence 3: Bundle Size Reduction
Request: "App loads slowly on first visit"

```
1. Analyze imports:
   lov-search-files(query="^import", include_pattern="src/**/*.tsx")

2. Identify heavy dependencies:
   - Large UI libraries (moment.js → date-fns)
   - Entire lodash imported (lodash → lodash-es)
   - No code splitting for routes

3. Implement code splitting:
   lov-line-replace(src/App.tsx, add_lazy_loading)
   
   ```typescript
   // ❌ BEFORE - All routes loaded upfront
   import Dashboard from './pages/Dashboard';
   import Profile from './pages/Profile';
   import Settings from './pages/Settings';
   
   // ✅ AFTER - Routes loaded on demand
   const Dashboard = lazy(() => import('./pages/Dashboard'));
   const Profile = lazy(() => import('./pages/Profile'));
   const Settings = lazy(() => import('./pages/Settings'));
   
   function App() {
     return (
       <Suspense fallback={<LoadingSpinner />}>
         <Routes>
           <Route path="/" element={<Dashboard />} />
           <Route path="/profile" element={<Profile />} />
           <Route path="/settings" element={<Settings />} />
         </Routes>
       </Suspense>
     );
   }
   ```

4. Replace heavy dependencies:
   - moment.js → date-fns (search and replace)
   - lodash → lodash-es (tree-shakeable)
   
   lov-search-files(query="from ['\"]moment['\"]", include_pattern="src/**")
   lov-line-replace(src/utils/dateHelpers.ts, replace_moment_with_date_fns)

5. Optimize imports:
   ```typescript
   // ❌ IMPORTS ENTIRE LIBRARY
   import _ from 'lodash';
   _.debounce(fn, 300);
   
   // ✅ TREE-SHAKEABLE IMPORT
   import { debounce } from 'lodash-es';
   debounce(fn, 300);
   ```

6. Remove unused dependencies:
   lov-search-files(query="package_name", include_pattern="src/**")
   // If no results, remove dependency:
   lov-remove-dependency("package_name")
```

### Sequence 4: Image Optimization
Request: "Images load slowly"

```
1. Find all images:
   lov-search-files(query="<img|src=|backgroundImage", include_pattern="src/**")

2. Analyze image usage:
   - Large file sizes (check network tab)
   - Wrong format (PNG for photos instead of WebP)
   - No lazy loading
   - No responsive images

3. Add lazy loading:
   lov-line-replace(src/components/Gallery.tsx, add_lazy_loading)
   
   ```typescript
   // ❌ BEFORE
   <img src={imageUrl} alt="Gallery item" />
   
   // ✅ AFTER
   <img 
     src={imageUrl} 
     alt="Gallery item"
     loading="lazy"
     decoding="async"
   />
   ```

4. Add responsive images:
   ```typescript
   // ❌ SINGLE SIZE
   <img src="/hero.jpg" alt="Hero" />
   
   // ✅ RESPONSIVE WITH SRCSET
   <img 
     src="/hero-1080.jpg"
     srcSet="
       /hero-320.jpg 320w,
       /hero-640.jpg 640w,
       /hero-1080.jpg 1080w,
       /hero-1920.jpg 1920w
     "
     sizes="(max-width: 640px) 320px,
            (max-width: 1024px) 640px,
            (max-width: 1920px) 1080px,
            1920px"
     alt="Hero"
     loading="lazy"
   />
   ```

5. Prioritize hero images:
   ```typescript
   // ✅ HERO IMAGE - LOAD IMMEDIATELY
   <img 
     src="/hero.jpg"
     alt="Hero"
     fetchpriority="high"
     loading="eager"
   />
   ```

6. Recommend WebP conversion:
   "Convert your PNG images to WebP format for 25-35% size reduction.
   Tools: Squoosh.app, ImageOptim, or build-time optimization."

7. Update all images:
   lov-line-replace(src/components/ImageGallery.tsx, optimize_images) ||
   lov-line-replace(src/pages/Home.tsx, optimize_hero_image)
```

### Sequence 5: React Query Caching
Request: "API calls happen on every navigation"

```
1. Check if React Query is installed:
   lov-search-files(query="useQuery|QueryClient", include_pattern="src/**")

2. If NOT using React Query:
   lov-add-dependency("@tanstack/react-query")
   
3. Set up React Query provider:
   lov-line-replace(src/main.tsx, add_query_client)
   
   ```typescript
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
   
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 1000 * 60 * 5, // 5 minutes
         cacheTime: 1000 * 60 * 30, // 30 minutes
         refetchOnWindowFocus: false,
       },
     },
   });
   
   root.render(
     <QueryClientProvider client={queryClient}>
       <App />
     </QueryClientProvider>
   );
   ```

4. Convert fetch hooks to React Query:
   lov-line-replace(src/hooks/usePosts.ts, convert_to_react_query)
   
   ```typescript
   // ❌ BEFORE - No caching
   const [posts, setPosts] = useState([]);
   useEffect(() => {
<!-- SUPABASE DISABLED:      supabase.from('posts').select('*').then(({ data }) => setPosts(data)); -->
   }, []);
   
   // ✅ AFTER - Automatic caching
   const { data: posts, isLoading } = useQuery({
     queryKey: ['posts'],
     queryFn: async () => {
<!-- SUPABASE DISABLED:        const { data } = await supabase.from('posts').select('*'); -->
       return data;
     },
     staleTime: 1000 * 60 * 5, // Cache for 5 minutes
   });
   ```

5. Add cache invalidation on mutations:
   ```typescript
   const { mutate: createPost } = useMutation({
     mutationFn: async (newPost) => {
<!-- SUPABASE DISABLED:        const { data } = await supabase.from('posts').insert(newPost); -->
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['posts'] });
     },
   });
   ```
```

## Critical Rules

1. **Diagnose before optimizing** - Use debugging tools first
2. **Measure impact** - Verify improvements with logs/network tab
3. **Optimize biggest bottleneck first** - 80/20 rule
4. **Don't premature optimize** - Only fix real performance issues
5. **Use profiling tools** - React DevTools Profiler, Chrome Performance tab
6. **Test on slow devices** - Throttle CPU/network in DevTools
7. **Consider bundle size** - Lighthouse score, bundle analyzer
8. **Cache aggressively** - React Query, service workers
9. **Lazy load everything** - Routes, components, images
10. **Monitor production** - Set up performance monitoring

## Common Mistakes

❌ Optimizing without measuring (guessing the bottleneck)
❌ Not using React.memo for expensive pure components
❌ Creating functions inside render (not using useCallback)
❌ Selecting all columns when only need a few (overfetching)
❌ N+1 query problem (fetching in loops instead of joins)
❌ No code splitting (entire app in one bundle)
❌ Loading all images eagerly (not using lazy loading)
❌ Not using React Query/caching (refetching on every mount)
❌ Large context causing global re-renders
❌ Not testing on slow devices/networks

## Performance Checklist

After optimization:

- ✅ React components use React.memo where appropriate
- ✅ Event handlers wrapped in useCallback
- ✅ Expensive calculations wrapped in useMemo
- ✅ Database queries use joins instead of loops
- ✅ Only necessary columns selected from database
- ✅ Pagination implemented for large datasets
- ✅ Database indexes created for frequently queried columns
- ✅ Routes use React.lazy for code splitting
- ✅ Images use lazy loading (loading="lazy")
- ✅ Hero images use priority loading (fetchpriority="high")
- ✅ React Query caching configured
- ✅ No console warnings in production
- ✅ Lighthouse score >90 for performance
