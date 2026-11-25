import { ResumeEditor } from '@/components/resume-editor';

export const metadata = { title: 'Editor · JobFlow' };

export default function EditorPage({ params }: { params: { id: string } }) {
  return <ResumeEditor id={params.id} />;
}
