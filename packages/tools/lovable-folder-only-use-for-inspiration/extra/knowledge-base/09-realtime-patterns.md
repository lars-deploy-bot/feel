# Realtime Patterns - Live Data Subscriptions

**Category:** Database Integration  
**Priority:** MEDIUM  
**Last Updated:** 2025-10-28

---

## Realtime Overview

Supabase supports real-time updates for database tables, allowing your application to receive live updates when data changes.

**Use cases:**
- Chat applications
- Live dashboards
- Collaborative editing
- Notifications
- Live activity feeds

---

## Enabling Realtime

### Step 1: Enable Replica Identity

Use `REPLICA IDENTITY FULL` to ensure complete row data is captured:

```sql
alter table your_table_name replica identity full;
```

### Step 2: Add Table to Realtime Publication

```sql
alter publication supabase_realtime add table your_table_name;
```

**Note:** No database-level configuration needed - realtime functionality is built-in.

---

## Listening to Changes

### Pattern 1: Listen to INSERT Events

```typescript
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export const useRealtimeInserts = (tableName: string, callback: (payload: any) => void) => {
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: tableName
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, callback]);
};

// Usage
const MyComponent = () => {
  useRealtimeInserts('messages', (payload) => {
    console.log('New message:', payload.new);
    // Add to messages list
  });
};
```

---

### Pattern 2: Listen to UPDATE Events

```typescript
useEffect(() => {
  const channel = supabase
    .channel('updates-channel')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'posts'
      },
      (payload) => {
        console.log('Post updated:', payload.new);
        // Update local state
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

### Pattern 3: Listen to DELETE Events

```typescript
useEffect(() => {
  const channel = supabase
    .channel('deletes-channel')
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'comments'
      },
      (payload) => {
        console.log('Comment deleted:', payload.old);
        // Remove from local state
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

### Pattern 4: Listen to All Events

```typescript
useEffect(() => {
  const channel = supabase
    .channel('all-changes')
    .on(
      'postgres_changes',
      {
        event: '*',  // All events
        schema: 'public',
        table: 'notifications'
      },
      (payload) => {
        console.log('Change detected:', payload.eventType, payload);
        
        switch (payload.eventType) {
          case 'INSERT':
            // Handle insert
            break;
          case 'UPDATE':
            // Handle update
            break;
          case 'DELETE':
            // Handle delete
            break;
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## Filtering Realtime Events

### Filter by Column Value

```typescript
useEffect(() => {
  const channel = supabase
    .channel('filtered-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`  // Only messages for specific room
      },
      (payload) => {
        console.log('New message in room:', payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [roomId]);
```

---

### Filter by User

```typescript
useEffect(() => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return;

  const channel = supabase
    .channel('user-notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`  // Only user's notifications
      },
      (payload) => {
        console.log('New notification:', payload.new);
        // Show toast notification
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## Complete Realtime Patterns

### Pattern 1: Chat Messages

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Message = {
  id: string;
  content: string;
  user_id: string;
  room_id: string;
  created_at: string;
};

export const useRealtimeChat = (roomId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    // Initial fetch
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (data) setMessages(data);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return messages;
};
```

---

### Pattern 2: Live Dashboard Metrics

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Metric = {
  id: string;
  name: string;
  value: number;
  updated_at: string;
};

export const useLiveMetrics = () => {
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    // Initial fetch
    const fetchMetrics = async () => {
      const { data } = await supabase
        .from('metrics')
        .select('*')
        .order('name');

      if (data) setMetrics(data);
    };

    fetchMetrics();

    // Subscribe to updates
    const channel = supabase
      .channel('metrics-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'metrics'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMetrics(prev => [...prev, payload.new as Metric]);
          } else if (payload.eventType === 'UPDATE') {
            setMetrics(prev =>
              prev.map(m => (m.id === payload.new.id ? payload.new as Metric : m))
            );
          } else if (payload.eventType === 'DELETE') {
            setMetrics(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return metrics;
};
```

---

### Pattern 3: Notification System

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Notification = {
  id: string;
  title: string;
  message: string;
  user_id: string;
  read: boolean;
  created_at: string;
};

export const useRealtimeNotifications = (userId: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Initial fetch
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
      }
    };

    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show toast
          toast(newNotif.title, {
            description: newNotif.message,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications(prev =>
            prev.map(n => (n.id === updated.id ? updated : n))
          );
          
          if (updated.read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
  };

  return { notifications, unreadCount, markAsRead };
};
```

---

### Pattern 4: Collaborative Editing (Presence)

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type User = {
  id: string;
  name: string;
  avatar_url?: string;
};

type PresenceState = {
  user: User;
  online_at: string;
};

export const usePresence = (roomId: string, currentUser: User) => {
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);

  useEffect(() => {
    const channel = supabase.channel(`room-${roomId}`, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state)
          .flat()
          .map((s: any) => s.user);
        
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user: currentUser,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUser]);

  return onlineUsers;
};
```

---

## Best Practices

### 1. Always Clean Up Subscriptions

```typescript
useEffect(() => {
  const channel = supabase.channel('my-channel');
  
  // Subscribe
  channel.on(...).subscribe();

  // CRITICAL: Clean up on unmount
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

### 2. Use Unique Channel Names

```typescript
// ✅ CORRECT: Unique channel names
const channel = supabase.channel(`messages-${roomId}`);
const channel2 = supabase.channel(`presence-${userId}`);

// ❌ WRONG: Generic channel names can conflict
const channel = supabase.channel('updates');
```

---

### 3. Handle Connection States

```typescript
const channel = supabase
  .channel('my-channel')
  .on('postgres_changes', { ... }, callback)
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connected to realtime');
    }
    if (status === 'CHANNEL_ERROR') {
      console.error('Connection error');
    }
    if (status === 'TIMED_OUT') {
      console.error('Connection timed out');
    }
  });
```

---

### 4. Optimize with Filters

```typescript
// ✅ CORRECT: Filter on server
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'messages',
  filter: `room_id=eq.${roomId}`  // Filter on server
}, callback)

// ❌ WRONG: Filter on client (receives all data)
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'messages'
}, (payload) => {
  if (payload.new.room_id === roomId) {  // Filter on client
    callback(payload);
  }
})
```

---

### 5. Combine Initial Fetch with Realtime

```typescript
// ✅ CORRECT: Fetch existing + subscribe to new
useEffect(() => {
  // 1. Fetch existing data
  const fetchData = async () => {
    const { data } = await supabase.from('posts').select('*');
    if (data) setPosts(data);
  };
  fetchData();

  // 2. Subscribe to new data
  const channel = supabase
    .channel('posts-channel')
    .on('postgres_changes', { ... }, callback)
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

---

## Common Issues

### Issue 1: Realtime Not Working

**Checklist:**
1. Replica identity enabled?
   ```sql
   alter table table_name replica identity full;
   ```

2. Table added to publication?
   ```sql
   alter publication supabase_realtime add table table_name;
   ```

3. RLS policies allow access?
   ```sql
   -- User must have SELECT permission via RLS
   create policy "Users can view posts"
   on posts for select
   to authenticated
   using (true);
   ```

---

### Issue 2: Memory Leaks

**Problem:** Subscriptions not cleaned up properly

**Solution:** Always return cleanup function:

```typescript
useEffect(() => {
  const channel = supabase.channel('my-channel');
  channel.on(...).subscribe();

  // CRITICAL: Clean up
  return () => {
    supabase.removeChannel(channel);
  };
}, [dependencies]);
```

---

### Issue 3: Duplicate Events

**Problem:** Receiving same event multiple times

**Root Causes:**
1. Multiple subscriptions to same channel
2. Effect running multiple times
3. Channel not cleaned up properly

**Solution:**
```typescript
// Use stable dependencies
useEffect(() => {
  const channel = supabase.channel('unique-name');
  // ... subscription code
  return () => supabase.removeChannel(channel);
}, []); // Empty deps or stable values only
```

---

## Related Documentation

- [Supabase Integration Patterns](./02-supabase-integration-patterns.md)
- [Authentication Patterns](./03-authentication-patterns.md)
- [RLS Patterns](./07-rls-patterns.md)
