import { useEffect, useState } from "react";
import 'fs'

const sessionUpdate = {
  type: "session.update",
  session: {
    tools: [
      {
        type: "function",
        name: "edit_paragraph",
        description: "Edit the content of a single paragraph",
        parameters: {
          type: "object",
          strict: true,
          properties: {
            oldParagraph: {
              type: "string",
              description: "The text of the paragraph you want to change. This should contain only the pure text of the old paragraphs, without tags like <h2>, <p>, </p>, etc."
            },
            newParagraph: {
              type: "string",
              description: "The text of the new paragraph.",
            },
          },
          required: ["oldParagraph", "newParagraph"],
        },
      },
      {
        type: "function",
        name: "delete_text",
        description: "Delete some text",
        parameters: {
          type: "object",
          strict: true,
          properties: {
            text: {
              type: "string",
              description: "The text you want to delete."
            },
          },
          required: ["text"],
        }
      },
      {
        type: "function",
        name: "add_paragraph",
        description: "add a paragraph at a point defined by sentences before that",
        parameters: {
          type: "object",
          strict: true,
          properties: {
            textBefore: {
              type: "string",
              description: "The text after which you want to add the paragraph"
            },
            addedParagraph: {
              type: "string",
              description: "The text you want to add."
            },
          },
          required: ["text", "addedParagraph"],
        },
      }
    ],
    tool_choice: "auto",
  },
};

function FunctionCallOutput({ functionCallOutput, documentContent }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold">Edit Operation</h3>
      <pre className="text-xs bg-gray-100 rounded-md p-2 overflow-x-auto">
        {JSON.stringify(functionCallOutput, null, 2)}
      </pre>
    </div>
  );
}

export default function ToolPanel({
  isSessionActive,
  sendClientEvent,
  events,
  filename,
  setFilename,
  documentContent,
  setDocumentContent
}) {
  const [functionAdded, setFunctionAdded] = useState(false);
  const [functionCallOutput, setFunctionCallOutput] = useState(null);

  useEffect(() => {
    if (!events || events.length === 0) return;

    const firstEvent = events[events.length - 1];
    if (!functionAdded && firstEvent.type === "session.created") {
      if (documentContent !== "") {
        sessionUpdate.session.instructions = "This is the content of a document: " + documentContent.content
        console.log("sessionUpdate: ", sessionUpdate)
      }
      sendClientEvent(sessionUpdate);
      setFunctionAdded(true);
    }

    const mostRecentEvent = events[0];
    if ( mostRecentEvent.type === "response.done" && mostRecentEvent.response.output ) {
      mostRecentEvent.response.output.forEach((output) => {
        {
          console.log("event type response.done output: ", output)
          console.log("filename: ", import.meta.env.VITE_DATA_PATH + filename)
        }
        if (output.type === "function_call" && output.name === "edit_paragraph") {
          setFunctionCallOutput(output);
          const {newParagraph} = JSON.parse(output.arguments);
          const {oldParagraph} = JSON.parse(output.arguments);
          const fullPath = import.meta.env.VITE_DATA_PATH + filename;
          (async () => {
            try {
              const resp = await fetch('http://localhost:8000/function-call', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  document_id: fullPath,
                  function_name: "editParagraph",
                  arguments: {
                    oldParagraph: oldParagraph,
                    newParagraph: newParagraph
                  }
                })
              });
              
              const data = await resp.json();
              setFilename(data.outputFileName)
              const mammoth = await import('mammoth');
              const options = {
                styleMap: [
                  "p[style-name='Heading 1'] => h1:fresh",
                  "p[style-name='Heading 2'] => h2:fresh",
                  "p[style-name='Heading 3'] => h3:fresh",
                  "p[style-name='Normal'] => p:fresh",
                  "table => table.doc-table",
                  "r[style-name='Strong'] => strong:fresh",
                  "r[style-name='Emphasis'] => em:fresh",
                  "p[style-name='List Paragraph'] => li:fresh"
                ],
                convertImage: mammoth.images.imgElement(function(image) {
                  return image.read("base64").then(function(imageBuffer) {
                    return {
                      src: "data:" + image.contentType + ";base64," + imageBuffer
                    };
                  });
                })
              };
              // Convert base64 to binary data
              const byteCharacters = atob(data.content);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              console.log('Received document content:', byteArray);
              const result = await mammoth.default.convertToHtml({ arrayBuffer: byteArray.buffer }, options);
              const documentData = {
                type: 'document',
                content: result.value,
                messages: result.messages
              };
              setDocumentContent(documentData);
            } catch (error) {
              console.error('Error:', error);
            }
          })();
        }
      });
    }
  }, [events]);

  useEffect(() => {
    if (!isSessionActive) {
      setFunctionAdded(false);
      setFunctionCallOutput(null);
    }
  }, [isSessionActive]);

  return (
    <section className="h-full w-full flex flex-col gap-4">
      <div className="h-full bg-gray-50 rounded-md p-4">
        <h2 className="text-lg font-bold">Document Editor Tool</h2>
        {isSessionActive ? (
          documentContent ? (
            functionCallOutput ? (
              <FunctionCallOutput 
                functionCallOutput={functionCallOutput}
                documentContent={documentContent}
              />
            ) : (
              <p>Ask for document edits like "modify cell A1 in Sheet1" or "add a new row"...</p>
            )
          ) : (
            <p>Please upload a document first...</p>
          )
        ) : (
          <p>Start the session to use this tool...</p>
        )}
      </div>
    </section>
  );
}