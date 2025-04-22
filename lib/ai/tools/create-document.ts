import { generateUUID } from '@/lib/utils';
import { DataStreamWriter, tool } from 'ai';
import { z } from 'zod';
import { Session } from 'next-auth';
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from '@/lib/artifacts/server';
import { deepResearch } from './deepResearch';
import { saveDocument } from '@/lib/db/queries';

interface CreateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
  enhanceWithDeepResearch?: boolean;
}

export const createDocument = ({ 
  session, 
  dataStream, 
  enhanceWithDeepResearch = false 
}: CreateDocumentProps) =>
  tool({
    description:
      'Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title and kind.',
    parameters: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
    }),
    execute: async ({ title, kind }) => {
      const id = generateUUID();

      dataStream.writeData({
        type: 'kind',
        content: kind,
      });

      dataStream.writeData({
        type: 'id',
        content: id,
      });

      dataStream.writeData({
        type: 'title',
        content: title,
      });

      dataStream.writeData({
        type: 'clear',
        content: '',
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      // If in deep research mode, use the research results for content
      if (enhanceWithDeepResearch) {
        try {
          // Extract query context from title
          const query = title;
          
          dataStream.writeData({
            type: 'processing',
            content: 'Conducting deep research on this topic...',
          });
          
          // Execute deep research
          const { result, reasoningChains, graphResults, webResults } = await deepResearch.execute({
            query,
            maxSteps: 10,
            chatId: id // Use document ID as chat ID for progress tracking
          });
          
          // For enhanced documents with research results, we need to handle it differently
          // First, simulate text delta streaming to update the UI
          const contentChunks = result.split(' ');
          let fullContent = '';
          
          for (const chunk of contentChunks) {
            const textDelta = chunk + ' ';
            fullContent += textDelta;
            
            dataStream.writeData({
              type: 'text-delta',
              content: textDelta,
            });
            
            // Add a small delay to simulate typing
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          
          // Save document with the research content using the standard saveDocument function
          // Note: The database schema doesn't have a metadata field, so we'll need to include
          // key information in the content itself
          
          // Create a formatted version with a "Research Sources" section at the end
          const formattedContent = `${fullContent}
`;
          
          if (session?.user?.id) {
            await saveDocument({
              id,
              title,
              content: formattedContent,
              kind,
              userId: session.user.id,
            });
          }
        } catch (error) {
          console.error("Deep research failed:", error);
          // Fallback to regular document creation
          await documentHandler.onCreateDocument({
            id,
            title,
            dataStream,
            session,
          });
        }
      } else {
        // Regular document creation flow
        await documentHandler.onCreateDocument({
          id,
          title,
          dataStream,
          session,
        });
      }

      dataStream.writeData({ type: 'finish', content: '' });

      return {
        id,
        title,
        kind,
        content: 'A document was created and is now visible to the user.',
      };
    },
  });
