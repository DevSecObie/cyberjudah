import { createFileRoute } from '@tanstack/react-router';
import { studyRequest } from '@/lib/study-server';
export const Route = createFileRoute('/study-answer')({server:{handlers:{POST:({request})=>studyRequest(request)}}});
