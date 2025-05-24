import { pool } from './db.js';

export async function searchEmails(query: string) {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const pattern = `%${query}%`;
    const result = await pool.query(`
      SELECT e.id, e.subject, e.sender, e.timestamp as date
      FROM emails e
      WHERE e.subject ILIKE $1 OR e.body ILIKE $1 OR e.sender ILIKE $1
      ORDER BY e.timestamp DESC 
      LIMIT 20
    `, [pattern]);

    console.log(`SIMPLE SEARCH: "${query}" found ${result.rows.length} emails`);
    return result.rows;
  } catch (error) {
    console.error('Simple search error:', error);
    return [];
  }
}

export async function searchTasks(query: string) {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const pattern = `%${query}%`;
    const result = await pool.query(`
      SELECT t.id, t.title, t.description, t.priority, t.status, t.due_date as "dueDate"
      FROM tasks t
      WHERE t.title ILIKE $1 OR t.description ILIKE $1
      ORDER BY t.created_at DESC 
      LIMIT 20
    `, [pattern]);

    console.log(`SIMPLE SEARCH: "${query}" found ${result.rows.length} tasks`);
    return result.rows;
  } catch (error) {
    console.error('Simple task search error:', error);
    return [];
  }
}