/**
 * lib/docx.ts — plain model → real .docx.
 *
 * No tables, no text boxes, no headers/footers, no images, no columns. Those
 * are the things that actually garble parsing; two-column layouts mostly
 * survive and are not worth the fear. Section headings use real Word heading
 * levels; empty sections are skipped entirely (an empty "PROJECTS" heading
 * reads as malformed).
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from 'docx';
import type { ResumeModel, SectionKey } from './types';
import { visibleBullets } from './tailor';

const BODY = 22; // half-points → 11pt
const SMALL = 20; // 10pt
const NAME = 40; // 20pt
const INK = '151A1A';
const MUTED = '55554C';

const SECTION_LABEL: Record<SectionKey, string> = {
  summary: 'Summary',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  skills: 'Skills',
};

function heading(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 260, after: 110 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B9B2A2', space: 3 },
    },
    children: [
      new TextRun({ text: label.toUpperCase(), bold: true, size: SMALL, color: INK }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 40 },
  });
}

function entryHeading(left: string, right?: string, options?: { italic?: boolean; muted?: boolean }) {
  const children = [
    new TextRun({
      text: left,
      bold: !options?.italic,
      italics: options?.italic,
      size: options?.italic ? SMALL : BODY,
      color: options?.muted ? MUTED : INK,
    }),
  ];
  if (right) {
    children.push(new TextRun({ children: [new Tab()] }));
    children.push(new TextRun({ text: right, size: SMALL, color: MUTED }));
  }
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: 10800 }],
    spacing: { before: 140, after: 20 },
    children,
  });
}

export function buildDocument(model: ResumeModel): Document {
  const children: Paragraph[] = [];

  if (model.name) {
    children.push(
      new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: model.name, bold: true, size: NAME, color: INK })],
      }),
    );
  }
  if (model.headline) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: model.headline, size: BODY, color: MUTED })],
      }),
    );
  }

  const contact = [model.contact.email, model.contact.phone, model.contact.location]
    .filter(Boolean)
    .join('  ·  ');
  if (contact) {
    children.push(
      new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: contact, size: SMALL, color: MUTED })],
      }),
    );
  }
  // Full URLs spelled out, never link labels: parsers and humans both want the
  // literal string, and a hyperlink label hides it.
  if (model.links.length) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: model.links.join('  ·  '), size: SMALL, color: MUTED })],
      }),
    );
  }

  for (const section of model.sections) {
    if (section === 'summary') {
      if (!model.summary) continue;
      children.push(heading(SECTION_LABEL.summary));
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: model.summary, size: BODY, color: INK })],
        }),
      );
    }

    if (section === 'experience') {
      const roles = model.experience.filter((r) => r.company || r.title);
      if (!roles.length) continue;
      children.push(heading(SECTION_LABEL.experience));
      for (const role of roles) {
        children.push(
          entryHeading(role.title || role.company, `${role.start}${role.end ? ` – ${role.end}` : ''}`),
        );
        const subline = [role.company, role.location].filter(Boolean).join(' · ');
        if (subline) {
          children.push(
            new Paragraph({
              spacing: { after: 40 },
              children: [new TextRun({ text: subline, italics: true, size: SMALL, color: MUTED })],
            }),
          );
        }
        for (const b of visibleBullets(role)) children.push(bullet(b.text));
      }
    }

    if (section === 'projects') {
      const projects = model.projects.filter((p) => p.name);
      if (!projects.length) continue;
      children.push(heading(SECTION_LABEL.projects));
      for (const project of projects) {
        children.push(entryHeading(project.name, project.link));
        for (const b of visibleBullets(project)) children.push(bullet(b.text));
      }
    }

    if (section === 'education') {
      const degrees = model.education.filter((e) => e.school || e.degree);
      if (!degrees.length) continue;
      children.push(heading(SECTION_LABEL.education));
      for (const ed of degrees) {
        const left = [ed.degree, ed.field].filter(Boolean).join(', ') || ed.school;
        children.push(entryHeading(left, `${ed.start}${ed.end ? ` – ${ed.end}` : ''}`));
        if (ed.school && left !== ed.school) {
          children.push(
            new Paragraph({
              spacing: { after: 40 },
              children: [new TextRun({ text: ed.school, italics: true, size: SMALL, color: MUTED })],
            }),
          );
        }
        if (ed.details) {
          children.push(
            new Paragraph({
              spacing: { after: 40 },
              children: [new TextRun({ text: ed.details, size: SMALL, color: MUTED })],
            }),
          );
        }
      }
    }

    if (section === 'skills') {
      if (!model.skills.length) continue;
      children.push(heading(SECTION_LABEL.skills));
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: model.skills.join('  ·  '), size: BODY, color: INK })],
        }),
      );
    }
  }

  return new Document({
    creator: 'JobFlow',
    title: model.name ? `${model.name} — Resume` : 'Resume',
    description: 'Generated by JobFlow from your own profile facts.',
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: BODY, color: INK },
          paragraph: { spacing: { line: 264, after: 40 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });
}

export function docxFilename(model: ResumeModel, jobTitle?: string | null): string {
  const slug = (s: string) =>
    s
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 48);
  const name = slug(model.name || 'Resume') || 'Resume';
  const role = slug(jobTitle ?? '') || (model.headline ? slug(model.headline.split('·')[0]) : 'Tailored');
  return `${name}_Resume_${role || 'Tailored'}.docx`;
}

/** Browser: returns a Blob ready for download. */
export async function resumeToDocxBlob(model: ResumeModel): Promise<Blob> {
  return Packer.toBlob(buildDocument(model));
}

/** Node/tests. */
export async function resumeToDocxBuffer(model: ResumeModel): Promise<Buffer> {
  return Packer.toBuffer(buildDocument(model));
}

/** Download helper that always revokes the object URL. */
export async function downloadDocx(model: ResumeModel, jobTitle?: string | null): Promise<void> {
  const blob = await resumeToDocxBlob(model);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = docxFilename(model, jobTitle);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
