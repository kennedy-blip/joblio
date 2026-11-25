import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildDocument, docxFilename, resumeToDocxBuffer } from '@/lib/docx';
import { tailorResume } from '@/lib/tailor';
import { SAMPLE_PROFILE } from '@/lib/sample';
import { supportJob } from './fixtures';
import type { ResumeModel } from '@/lib/types';

const FIXTURE = join(__dirname, 'fixtures', 'canonical-resume.txt');

function model(): ResumeModel {
  return tailorResume(SAMPLE_PROFILE, supportJob).model;
}

/** WordprocessingML → the text a human or parser actually sees. */
export function documentXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

describe('.docx export', () => {
  it('is a valid zip with a wordprocessing document', async () => {
    const buffer = await resumeToDocxBuffer(model());
    const files = unzipSync(new Uint8Array(buffer));
    expect(Object.keys(files)).toContain('word/document.xml');
    expect(Object.keys(files)).toContain('[Content_Types].xml');
  });

  it('contains no tables, text boxes, headers or footers', async () => {
    const buffer = await resumeToDocxBuffer(model());
    const files = unzipSync(new Uint8Array(buffer));
    const xml = strFromU8(files['word/document.xml']);
    expect(xml).not.toContain('<w:tbl');
    expect(xml).not.toContain('<w:txbxContent');
    expect(Object.keys(files).some((f) => /word\/(header|footer)\d*\.xml/.test(f))).toBe(false);
    expect(Object.keys(files).some((f) => f.startsWith('word/media/'))).toBe(false);
  });

  it('keeps every bullet the model says is visible, verbatim', async () => {
    const m = model();
    const buffer = await resumeToDocxBuffer(m);
    const text = documentXmlToText(strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml']));
    for (const role of m.experience) {
      for (const b of role.bullets.filter((x) => !x.hidden)) {
        expect(text).toContain(b.text);
      }
    }
    expect(text).toContain(SAMPLE_PROFILE.name);
    expect(text).toContain('github.com/kennedy-wanjiru');
  });

  it('skips empty sections instead of printing a bare heading', async () => {
    const m = model();
    m.projects = [];
    const buffer = await resumeToDocxBuffer(m);
    const text = documentXmlToText(strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml']));
    expect(text).not.toContain('PROJECTS');
  });

  it('matches the golden text snapshot', async () => {
    const buffer = await resumeToDocxBuffer(model());
    const text = documentXmlToText(strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml']));
    if (!existsSync(FIXTURE)) {
      mkdirSync(join(__dirname, 'fixtures'), { recursive: true });
      writeFileSync(FIXTURE, `${text}\n`, 'utf8');
    }
    const golden = readFileSync(FIXTURE, 'utf8').replace(/\n$/, '');
    expect(text).toBe(golden);
  });

  it('names the file from the model rather than hardcoding a person', () => {
    const m = model();
    expect(docxFilename(m, supportJob.title)).toBe(
      'Kennedy_Wanjiru_Resume_Customer_Support_Specialist.docx',
    );
  });

  it('builds a Document object without a browser', () => {
    expect(buildDocument(model())).toBeDefined();
  });
});
