import { useEffect, useState } from "react";

const sessionUpdate = {
  type: "session.update",
  session: {
    tools: [
      {
        type: "function",
        name: "edit_document",
        description: "Edit the content of the document",
        parameters: {
          type: "object",
          strict: true,
          properties: {
            documentType: {
              type: "string",
              enum: ["spreadsheet", "document"],
              description: "Type of document being edited"
            },
            operation: {
              type: "string",
              enum: ["modify_cell", "modify_paragraph", "add_row", "delete_row", "replace_text"],
              description: "Type of edit operation to perform",
            },
            location: {
              type: "object",
              properties: {
                sheetName: { 
                  type: "string",
                  description: "Name of the sheet to edit (for spreadsheets only)"
                },
                row: { 
                  type: "number",
                  description: "Row number (for spreadsheets) or paragraph number (for documents)"
                },
                column: { 
                  type: "number",
                  description: "Column number (for spreadsheets only)"
                }
              },
              description: "Location in the document to perform the edit",
            },
            content: {
              type: "string",
              description: "New content to insert",
            }
          },
          required: ["documentType", "operation", "location", "content"],
        },
      },
    ],
    tool_choice: "auto",
  },
};

function FunctionCallOutput({ functionCallOutput, documentContent }) {
  const { operation, sheetName, location, content } = JSON.parse(functionCallOutput.arguments);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold">Edit Operation</h3>
      <p>Operation: {operation}</p>
      <p>Sheet: {sheetName}</p>
      <p>Location: Row {location.row}, Column {location.column}</p>
      <p>New Content: {content}</p>
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
  documentContent,
}) {
  const [functionAdded, setFunctionAdded] = useState(false);
  const [functionCallOutput, setFunctionCallOutput] = useState(null);

  useEffect(() => {
    if (!events || events.length === 0) return;

    const firstEvent = events[events.length - 1];
    if (!functionAdded && firstEvent.type === "session.created") {
      sendClientEvent(sessionUpdate);
      setFunctionAdded(true);
    }

    const mostRecentEvent = events[0];
    if (
      mostRecentEvent.type === "response.done" &&
      mostRecentEvent.response.output
    ) {
      mostRecentEvent.response.output.forEach((output) => {
        if (
          output.type === "function_call" &&
          output.name === "edit_document"
        ) {
          setFunctionCallOutput(output);
          setTimeout(() => {
            sendClientEvent({
              type: "response.create",
              response: {
                instructions: "Ask if they want to make any other changes to the document.",
              },
            });
          }, 500);
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