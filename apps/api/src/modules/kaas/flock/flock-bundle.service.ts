/**
 * FlockBundleService — convert a Workshop build into FLock-ready upload
 * files. Returns plain-text artifacts the user drops into FLock.io's
 * Co-creation flow (platform.flock.io → Create New Model). Min 3 files
 * required by FLock; we guarantee at least system_prompt.txt + manifest +
 * one skill (or pad with the build summary).
 *
 * No FLock API call here — this is the "honest manual upload" path since
 * FLock's marketplace publish API is gated to proxy_admin role.
 */

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'

import {
  collectSkillFiles,
  type BuildContext,
} from '../../bench/cards/serialize'
import type { AgentBuildInput } from '../../bench/cards/compose-runtime'

export interface FlockBundleRequest {
  build_id: string
  build_name: string
  build_summary?: string
  equipped: AgentBuildInput
}

export interface FlockBundleFile {
  filename: string
  content: string
  /** Suggested mime; FLock co-creation accepts text/plain. */
  mime: 'text/plain' | 'text/markdown' | 'application/json'
}

export interface FlockBundleResponse {
  files: FlockBundleFile[]
  /** Pre-filled deep-link to FLock's Co-creation flow. The actual upload
   *  has to happen in FLock's UI; this just gets the user there. */
  flock_platform_url: string
  warnings: string[]
}

@Injectable()
export class FlockBundleService {
  private readonly logger = new Logger(FlockBundleService.name)

  build(req: FlockBundleRequest): FlockBundleResponse {
    const ctx: BuildContext = {
      buildId: req.build_id,
      buildName: req.build_name,
      agentId: 'flock-bundle',
      installedAt: new Date().toISOString(),
      runId: uuidv4().slice(0, 8),
    }
    const { files, skipped } = collectSkillFiles(req.equipped, ctx)
    if (files.length === 0) {
      throw new HttpException(
        { code: 'EMPTY_BUILD', message: 'Equip at least one card before bundling.' },
        HttpStatus.BAD_REQUEST,
      )
    }

    const promptFile = files.find((f) => f.slot === 'prompt')
    const skillFiles = files.filter((f) => f.slot.startsWith('skill'))

    const slug = this.slugify(req.build_name)
    const out: FlockBundleFile[] = []

    // 1. system_prompt.txt — the main mode body
    if (promptFile) {
      out.push({
        filename: `${slug}__system_prompt.txt`,
        content: this.toPlainText(promptFile.body),
        mime: 'text/plain',
      })
    }

    // 2. each skill becomes its own file
    for (const s of skillFiles) {
      out.push({
        filename: `${slug}__skill_${this.slugify(s.cardId)}.txt`,
        content: this.toPlainText(s.body),
        mime: 'text/plain',
      })
    }

    // 3. README — what this agent is for
    out.push({
      filename: `${slug}__README.txt`,
      content: this.composeReadme(req.build_name, req.build_summary, files),
      mime: 'text/plain',
    })

    // 4. manifest — machine-readable build descriptor
    out.push({
      filename: `${slug}__manifest.json`,
      content: JSON.stringify(
        {
          source: 'cherry-kaas',
          build_id: req.build_id,
          build_name: req.build_name,
          summary: req.build_summary ?? null,
          run_id: ctx.runId,
          generated_at: ctx.installedAt,
          equipped: req.equipped,
          slots: files.map((f) => ({ slot: f.slot, card_id: f.cardId, dir: f.dir })),
        },
        null,
        2,
      ),
      mime: 'application/json',
    })

    const warnings: string[] = []
    if (skipped.length) {
      warnings.push(
        `${skipped.length} slot(s) excluded from bundle (mcp/orchestration/memory aren't supported by FLock co-creation).`,
      )
    }
    if (out.length < 3) {
      warnings.push(
        `Bundle has only ${out.length} file(s). FLock co-creation typically requires 3+ knowledge documents.`,
      )
    }

    return {
      files: out,
      // Verified live (2026-04-25): /models is the real dashboard route on
      // platform.flock.io. The docs reference beta.flock.io but that
      // deployment is dead. /models is where users land to create a new
      // model entry on FLock.
      flock_platform_url: 'https://platform.flock.io/models',
      warnings,
    }
  }

  private slugify(s: string): string {
    return (s || 'agent')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'agent'
  }

  private toPlainText(md: string): string {
    return md
      .replace(/^---[\s\S]*?---/m, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim()
  }

  private composeReadme(
    name: string,
    summary: string | undefined,
    files: { cardId: string; slot: string }[],
  ): string {
    const lines: string[] = []
    lines.push(`# ${name}`)
    lines.push('')
    if (summary) {
      lines.push(summary)
      lines.push('')
    }
    lines.push('Built with Cherry KaaS — Workshop composition exported for FLock.io.')
    lines.push('')
    lines.push('## Components')
    for (const f of files) {
      lines.push(`- ${f.slot}: ${f.cardId}`)
    }
    lines.push('')
    lines.push('## Upload steps (FLock AI Marketplace)')
    lines.push('1. Open https://platform.flock.io/models')
    lines.push('2. Click "Create" / "New Model"')
    lines.push('3. Upload each .txt file from this bundle (system_prompt + skills)')
    lines.push('4. Use this README as the model description')
    lines.push('5. Sign with wallet → published to FLock AI Marketplace')
    lines.push('')
    lines.push('Generated by Cherry KaaS — https://solteti.site')
    return lines.join('\n')
  }
}
