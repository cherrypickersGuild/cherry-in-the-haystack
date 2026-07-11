import { Octokit } from '@octokit/rest'

export interface GitHubCommitter {
  commitFiles(
    files: { path: string; content: string }[],
    message: string,
  ): Promise<string>

  createPullRequest(params: {
    branch: string
    title: string
    body: string
    files: { path: string; content: string }[]
  }): Promise<{ prNumber: number; prUrl: string }>
}

const BASE_BRANCH = 'feature/browser-crawl-agent'

const BOT_IDENTITY = {
  name: 'handbook-bot',
  email: 'handbook-bot@users.noreply.github.com',
} as const

export class OctokitGitHubCommitter implements GitHubCommitter {
  private octokit: Octokit
  private owner: string
  private repo: string

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token })
    this.owner = owner
    this.repo = repo
  }

  static fromEnv(): OctokitGitHubCommitter {
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_REPO_OWNER
    const repo = process.env.GITHUB_REPO_NAME
    if (!token || !owner || !repo) {
      throw new Error(
        'Missing required env vars: GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME',
      )
    }
    return new OctokitGitHubCommitter(token, owner, repo)
  }

  async createPullRequest(params: {
    branch: string
    title: string
    body: string
    files: { path: string; content: string }[]
  }): Promise<{ prNumber: number; prUrl: string }> {
    const { branch, title, body, files } = params
    const { owner, repo } = this

    let branchCreated = false
    try {
      // Step 1: Find and close any existing open PRs for this branch (AC2 — GitHub part)
      const existingPRs = await this.octokit.rest.pulls.list({
        owner,
        repo,
        head: `${owner}:${branch}`,
        state: 'open',
      })
      for (const pr of existingPRs.data) {
        await this.octokit.rest.pulls.update({
          owner,
          repo,
          pull_number: pr.number,
          state: 'closed',
        })
      }
      // Delete the existing branch so we can recreate it fresh from current base
      if (existingPRs.data.length > 0) {
        try {
          await this.octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${branch}` })
        } catch {
          // best-effort: branch deletion may fail if branch doesn't exist independently
        }
      }

      // Step 2: Get current SHA of the base branch
      const base = await this.octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: BASE_BRANCH,
      })
      const baseSha = base.data.commit.sha

      // Step 3: Create head branch from base
      await this.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: baseSha,
      })
      branchCreated = true

      // Step 4: Commit each file with handbook-bot identity
      for (const file of files) {
        await this.octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: file.path,
          message: `feat(crawler): add generated crawler for ${branch.replace('feat/crawler/', '')}`,
          content: Buffer.from(file.content).toString('base64'),
          branch,
          committer: BOT_IDENTITY,
          author: BOT_IDENTITY,
        })
      }

      // Step 5: Open PR targeting BASE_BRANCH
      const pr = await this.octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head: branch,
        base: BASE_BRANCH,
      })

      return { prNumber: pr.data.number, prUrl: pr.data.html_url }
    } catch (err) {
      // AC3: attempt to clean up orphaned branch if it was created before the failure
      if (branchCreated) {
        try {
          await this.octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${branch}` })
        } catch {
          // cleanup is best-effort; do not mask the original error
        }
      }
      const status = (err as Record<string, unknown>)?.status
      const message = err instanceof Error ? err.message : String(err)
      if (status !== undefined) {
        throw new Error(`GitHub API error ${status}: ${message}`)
      }
      throw err
    }
  }

  async commitFiles(
    files: { path: string; content: string }[],
    message: string,
  ): Promise<string> {
    for (const file of files) {
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: file.path,
        message,
        content: Buffer.from(file.content).toString('base64'),
        branch: BASE_BRANCH,
        committer: BOT_IDENTITY,
        author: BOT_IDENTITY,
      })
    }
    return BASE_BRANCH
  }
}
