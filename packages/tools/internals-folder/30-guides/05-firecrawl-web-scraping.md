# Firecrawl Web Scraping Integration

## When to Use This Guide

This guide is for implementing the Firecrawl API in your project to enable **users of your application** to scrape websites.

**Important**: If you only need to collect information from a website for yourself, use the `alive-fetch-website` tool instead - do not implement Firecrawl.

## API Key Management

<!-- SUPABASE DISABLED: ### With Supabase Connection -->
<!-- SUPABASE DISABLED: Store the Firecrawl API key in Supabase Edge Function Secrets and authenticate requests using that key. -->

<!-- SUPABASE DISABLED: ### Without Supabase Connection -->
<!-- SUPABASE DISABLED: 1. Suggest connecting to Supabase first (recommended) -->
2. As fallback: Create temporary input field for users to enter their API key
3. Use the provided key to authenticate requests

## Implementation Example

### Crawl Form Component

```typescript
// src/components/CrawlForm.tsx
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FirecrawlService } from '@/utils/FirecrawlService';
import { Card } from "@/components/ui/card";

interface CrawlResult {
  success: boolean;
  status?: string;
  completed?: number;
  total?: number;
  creditsUsed?: number;
  expiresAt?: string;
  data?: any[];
}

export const CrawlForm = () => {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setProgress(0);
    setCrawlResult(null);
    
    try {
      const apiKey = FirecrawlService.getApiKey();
      if (!apiKey) {
        toast({
          title: "Error",
          description: "Please set your API key first",
          variant: "destructive",
        });
        return;
      }

      console.log('Starting crawl for URL:', url);
      const result = await FirecrawlService.crawlWebsite(url);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Website crawled successfully",
        });
        setCrawlResult(result.data);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to crawl website",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error crawling website:', error);
      toast({
        title: "Error",
        description: "Failed to crawl website",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="url">Website URL</label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
          />
        </div>
        {isLoading && <Progress value={progress} />}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Crawling..." : "Start Crawl"}
        </Button>
      </form>

      {crawlResult && (
        <Card className="mt-6 p-4">
          <h3 className="text-lg font-semibold mb-2">Crawl Results</h3>
          <div className="space-y-2 text-sm">
            <p>Status: {crawlResult.status}</p>
            <p>Completed: {crawlResult.completed}/{crawlResult.total}</p>
            <p>Credits: {crawlResult.creditsUsed}</p>
          </div>
        </Card>
      )}
    </div>
  );
};
```

### Firecrawl Service

```typescript
// FirecrawlService.ts
import FirecrawlApp from '@mendable/firecrawl-js';

interface ErrorResponse {
  success: false;
  error: string;
}

interface CrawlStatusResponse {
  success: true;
  status: string;
  completed: number;
  total: number;
  creditsUsed: number;
  expiresAt: string;
  data: any[];
}

type CrawlResponse = CrawlStatusResponse | ErrorResponse;

export class FirecrawlService {
  private static API_KEY_STORAGE_KEY = 'firecrawl_api_key';
  private static firecrawlApp: FirecrawlApp | null = null;

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    this.firecrawlApp = new FirecrawlApp({ apiKey });
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY);
  }

  static async testApiKey(apiKey: string): Promise<boolean> {
    try {
      this.firecrawlApp = new FirecrawlApp({ apiKey });
      const testResponse = await this.firecrawlApp.crawlUrl('https://example.com', {
        limit: 1
      });
      return testResponse.success;
    } catch (error) {
      return false;
    }
  }

  static async crawlWebsite(url: string): Promise<{ 
    success: boolean; 
    error?: string; 
    data?: any 
  }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'API key not found' };
    }

    try {
      if (!this.firecrawlApp) {
        this.firecrawlApp = new FirecrawlApp({ apiKey });
      }

      const crawlResponse = await this.firecrawlApp.crawlUrl(url, {
        limit: 100,
        scrapeOptions: {
          formats: ['markdown', 'html'],
        }
      }) as CrawlResponse;

      if (!crawlResponse.success) {
        return { 
          success: false, 
          error: (crawlResponse as ErrorResponse).error 
        };
      }

      return { 
        success: true,
        data: crawlResponse 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'API connection failed' 
      };
    }
  }
}
```

## Key Features

- **Progress Tracking**: Visual feedback during crawl operations
- **Error Handling**: Comprehensive error management
- **Result Display**: Structured presentation of crawl data
- **API Key Validation**: Test API key before crawling
- **Credit Tracking**: Monitor API credit usage

---

**Remember**: Only implement Firecrawl when your users need scraping capabilities. For your own data collection needs, use the built-in fetch tools.
