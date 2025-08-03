import { NextRequest, NextResponse } from 'next/server';
import { imageUploadService } from '@/lib/image-upload';
import { sessionService } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'No token provided' }, { status: 401 });
    }

    const session = await sessionService.validateSession(token);
    if (!session || !session.isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // Clean up old images (older than 24 hours)
    await imageUploadService.cleanupOldImages(24);
    
    // Clean up old sessions (older than 30 days)
    await sessionService.cleanupOldSessions();

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed successfully'
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Cleanup failed' 
      }, 
      { status: 500 }
    );
  }
}