import path from 'node:path';
import express from 'express';
import dotenv from 'dotenv';
import jiraRouter from './routes/jira.js';
import githubRouter from './routes/github.js';
import workspaceRouter from './routes/workspace.js';
import configRouter from './routes/config.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true, quiet: true });

const app = express();
const PORT = Number(process.env.SERVER_PORT) || 58471;

app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.use('/api/config', configRouter);
app.use('/api/jira', jiraRouter);
app.use('/api/github', githubRouter);
app.use('/api/workspace', workspaceRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    jira: !!(process.env.JIRA_DOMAIN && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN),
    localReposRoot: !!process.env.LOCAL_REPOS_ROOT?.trim(),
  });
});

app.listen(PORT, () => {
  console.log(`[server] Proxy running on http://localhost:${PORT}`);
  console.log(
    `[server] Jira: ${process.env.JIRA_DOMAIN ? `configured (${process.env.JIRA_DOMAIN})` : 'not configured (use app Settings or .env)'}`
  );
  console.log(
    `[server] Local repos root: ${process.env.LOCAL_REPOS_ROOT?.trim() ? `configured (${process.env.LOCAL_REPOS_ROOT})` : 'not configured'}`
  );
});
