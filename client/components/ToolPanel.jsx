import { useEffect, useState } from "react";

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
              description: "The text of the paragraph you want to change"
            },
            newParagraph: {
              type: "string",
              description: "The text of the new paragraph",
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
      // sessionUpdate.tools[0].description = documentContent
      if (documentContent !== "") {
        sessionUpdate.session.instructions = "This is the content of a document: " + JSON.stringify(documentContent)
        console.log("Dada", sessionUpdate)
      }
      sendClientEvent(sessionUpdate);
      setFunctionAdded(true);
    }

    const mostRecentEvent = events[0];
    if (
      mostRecentEvent.type === "response.done" &&
      mostRecentEvent.response.output
    ) {
      mostRecentEvent.response.output.forEach((output) => {
        {
          console.log(output, "Dada")  
        }
        if (
          output.type === "function_call" &&
          output.name === "edit_document"
        ) {
          console.log(output, "dada")
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