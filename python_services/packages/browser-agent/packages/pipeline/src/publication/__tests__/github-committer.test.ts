import { OctokitGitHubCommitter } from '../github-committer'

// Jest exception: variables prefixed with 'mock' can be referenced in jest.mock() factory
const mockOctokitInstance = {
  rest: {
    repos: {
      getBranch: jest.fn(),
      createOrUpdateFileContents: jest.fn(),
    },
    git: {
      createRef: jest.fn(),
      deleteRef: jest.fn(),
    },
    pulls: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => mockOctokitInstance),
}))

const PARAMS = {
  branch: 'feat/crawler/test-blog',
  title: 'feat(crawler): add test-blog crawler',
  body: 'Source: Test Blog\nGenerated at: 2026-05-24',
  files: [
    {
      path: 'python_services/crawlers/generated/test-blog.py',
      content: '# generated crawler',
    },
  ],
}

describe('OctokitGitHubCommitter.createPullRequest', () => {
  let committer: OctokitGitHubCommitter

  beforeEach(() => {
    jest.clearAllMocks()
    // Default happy-path mock responses
    mockOctokitInstance.rest.pulls.list.mockResolvedValue({ data: [] })
    mockOctokitInstance.rest.repos.getBranch.mockResolvedValue({
      data: { commit: { sha: 'abc123' } },
    })
    mockOctokitInstance.rest.git.createRef.mockResolvedValue({})
    mockOctokitInstance.rest.repos.createOrUpdateFileContents.mockResolvedValue({})
    mockOctokitInstance.rest.pulls.create.mockResolvedValue({
      data: { number: 42, html_url: 'https://github.com/org/repo/pull/42' },
    })
    mockOctokitInstance.rest.pulls.update.mockResolvedValue({})
    mockOctokitInstance.rest.git.deleteRef.mockResolvedValue({})

    committer = new OctokitGitHubCommitter('token', 'org', 'repo')
  })

  // ─── AC1: Success path ───

  it('creates branch from base, commits file with handbook-bot, opens PR, returns prNumber and prUrl', async () => {
    const result = await committer.createPullRequest(PARAMS)

    expect(result).toEqual({
      prNumber: 42,
      prUrl: 'https://github.com/org/repo/pull/42',
    })
    expect(mockOctokitInstance.rest.repos.getBranch).toHaveBeenCalledWith(
      expect.objectContaining({ branch: 'feature/browser-crawl-agent' }),
    )
    expect(mockOctokitInstance.rest.git.createRef).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: 'refs/heads/feat/crawler/test-blog',
        sha: 'abc123',
      }),
    )
    expect(mockOctokitInstance.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'python_services/crawlers/generated/test-blog.py',
        branch: 'feat/crawler/test-blog',
        committer: { name: 'handbook-bot', email: 'handbook-bot@users.noreply.github.com' },
        author: { name: 'handbook-bot', email: 'handbook-bot@users.noreply.github.com' },
      }),
    )
    expect(mockOctokitInstance.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        head: 'feat/crawler/test-blog',
        base: 'feature/browser-crawl-agent',
        title: PARAMS.title,
        body: PARAMS.body,
      }),
    )
  })

  it('file content is base64-encoded', async () => {
    await committer.createPullRequest(PARAMS)
    const call = mockOctokitInstance.rest.repos.createOrUpdateFileContents.mock.calls[0][0]
    const decoded = Buffer.from(call.content as string, 'base64').toString('utf8')
    expect(decoded).toBe('# generated crawler')
  })

  it('does not close any PR when no existing open PRs found', async () => {
    await committer.createPullRequest(PARAMS)
    expect(mockOctokitInstance.rest.pulls.update).not.toHaveBeenCalled()
  })

  it('searches for open PRs on the correct head branch', async () => {
    await committer.createPullRequest(PARAMS)
    expect(mockOctokitInstance.rest.pulls.list).toHaveBeenCalledWith(
      expect.objectContaining({
        head: 'org:feat/crawler/test-blog',
        state: 'open',
      }),
    )
  })

  // ─── AC2: Duplicate PR handling ───

  it('closes existing open PR before opening new one', async () => {
    mockOctokitInstance.rest.pulls.list.mockResolvedValue({ data: [{ number: 7 }] })

    await committer.createPullRequest(PARAMS)

    expect(mockOctokitInstance.rest.pulls.update).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 7, state: 'closed' }),
    )
    expect(mockOctokitInstance.rest.pulls.create).toHaveBeenCalled()
  })

  it('deletes the existing branch after closing the PR so it can be recreated fresh', async () => {
    mockOctokitInstance.rest.pulls.list.mockResolvedValue({ data: [{ number: 7 }] })

    await committer.createPullRequest(PARAMS)

    expect(mockOctokitInstance.rest.git.deleteRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'heads/feat/crawler/test-blog' }),
    )
    expect(mockOctokitInstance.rest.git.createRef).toHaveBeenCalled()
  })

  it('closes multiple open PRs if more than one exists', async () => {
    mockOctokitInstance.rest.pulls.list.mockResolvedValue({
      data: [{ number: 3 }, { number: 9 }],
    })

    await committer.createPullRequest(PARAMS)

    expect(mockOctokitInstance.rest.pulls.update).toHaveBeenCalledTimes(2)
    expect(mockOctokitInstance.rest.pulls.update).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 3, state: 'closed' }),
    )
    expect(mockOctokitInstance.rest.pulls.update).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 9, state: 'closed' }),
    )
  })

  // ─── AC3: GitHub API error handling ───

  it('throws descriptive error including status on GitHub API failure', async () => {
    const apiError = Object.assign(new Error('Forbidden'), { status: 403 })
    mockOctokitInstance.rest.repos.getBranch.mockRejectedValue(apiError)

    await expect(committer.createPullRequest(PARAMS)).rejects.toThrow(
      'GitHub API error 403',
    )
  })

  it('includes the original error message in the thrown error', async () => {
    const apiError = Object.assign(new Error('Resource not found'), { status: 404 })
    mockOctokitInstance.rest.repos.getBranch.mockRejectedValue(apiError)

    await expect(committer.createPullRequest(PARAMS)).rejects.toThrow('Resource not found')
  })

  it('re-throws non-GitHub errors as-is', async () => {
    const networkError = new Error('Network timeout')
    mockOctokitInstance.rest.repos.getBranch.mockRejectedValue(networkError)

    await expect(committer.createPullRequest(PARAMS)).rejects.toThrow('Network timeout')
  })

  it('uses String(err) for message when error is not an Error instance but has status', async () => {
    const plainObjError = { status: 422, toString: () => 'plain object error' }
    mockOctokitInstance.rest.repos.getBranch.mockRejectedValue(plainObjError)

    await expect(committer.createPullRequest(PARAMS)).rejects.toThrow('GitHub API error 422')
  })

  it('attempts branch cleanup when commit step fails after branch was created', async () => {
    const apiError = Object.assign(new Error('Unprocessable'), { status: 422 })
    mockOctokitInstance.rest.repos.createOrUpdateFileContents.mockRejectedValue(apiError)

    await expect(committer.createPullRequest(PARAMS)).rejects.toThrow('422')

    expect(mockOctokitInstance.rest.git.deleteRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'heads/feat/crawler/test-blog' }),
    )
  })

  it('does NOT attempt branch cleanup when failure happens before branch creation', async () => {
    const apiError = Object.assign(new Error('Forbidden'), { status: 403 })
    mockOctokitInstance.rest.repos.getBranch.mockRejectedValue(apiError)

    await expect(committer.createPullRequest(PARAMS)).rejects.toThrow()

    // deleteRef should NOT be called as branch was never created
    expect(mockOctokitInstance.rest.git.deleteRef).not.toHaveBeenCalled()
  })
})

describe('OctokitGitHubCommitter.commitFiles', () => {
  let committer: OctokitGitHubCommitter

  beforeEach(() => {
    jest.clearAllMocks()
    mockOctokitInstance.rest.repos.createOrUpdateFileContents.mockResolvedValue({})
    committer = new OctokitGitHubCommitter('token', 'org', 'repo')
  })

  it('commits each file to feature/browser-crawl-agent with handbook-bot identity', async () => {
    const files = [
      { path: 'config/sources.yaml', content: 'sources: []' },
      { path: 'config/other.yaml', content: 'other: true' },
    ]

    await committer.commitFiles(files, 'feat: add new sources')

    expect(mockOctokitInstance.rest.repos.createOrUpdateFileContents).toHaveBeenCalledTimes(2)
    expect(mockOctokitInstance.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'config/sources.yaml',
        message: 'feat: add new sources',
        branch: 'feature/browser-crawl-agent',
        committer: { name: 'handbook-bot', email: 'handbook-bot@users.noreply.github.com' },
      }),
    )
  })

  it('returns the base branch name', async () => {
    const result = await committer.commitFiles(
      [{ path: 'config/sources.yaml', content: 'sources: []' }],
      'chore: update sources',
    )
    expect(result).toBe('feature/browser-crawl-agent')
  })
})

describe('OctokitGitHubCommitter.fromEnv', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('creates instance from env vars', () => {
    process.env.GITHUB_TOKEN = 'test-token'
    process.env.GITHUB_REPO_OWNER = 'test-org'
    process.env.GITHUB_REPO_NAME = 'test-repo'

    expect(() => OctokitGitHubCommitter.fromEnv()).not.toThrow()
  })

  it('throws when GITHUB_TOKEN is missing', () => {
    delete process.env.GITHUB_TOKEN
    process.env.GITHUB_REPO_OWNER = 'test-org'
    process.env.GITHUB_REPO_NAME = 'test-repo'

    expect(() => OctokitGitHubCommitter.fromEnv()).toThrow('GITHUB_TOKEN')
  })

  it('throws when GITHUB_REPO_OWNER is missing', () => {
    process.env.GITHUB_TOKEN = 'test-token'
    delete process.env.GITHUB_REPO_OWNER
    process.env.GITHUB_REPO_NAME = 'test-repo'

    expect(() => OctokitGitHubCommitter.fromEnv()).toThrow('GITHUB_REPO_OWNER')
  })

  it('throws when GITHUB_REPO_NAME is missing', () => {
    process.env.GITHUB_TOKEN = 'test-token'
    process.env.GITHUB_REPO_OWNER = 'test-org'
    delete process.env.GITHUB_REPO_NAME

    expect(() => OctokitGitHubCommitter.fromEnv()).toThrow('GITHUB_REPO_NAME')
  })
})
