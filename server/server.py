from fastapi import FastAPI, HTTPException, Body, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from documentEditor import DocEditor
import httpx
import os
import base64



openai_api_key = os.getenv("OPENAI_API_KEY")

EDIT_PARAGRAPH = 'editParagraph'
DELETE_TEXT = 'deleteText'
ADD_PARAGRAPH = 'addParagraph'

OLD_PARAGRAPH = 'oldParagraph'
NEW_PARAGRAPH = 'newParagraph'

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     # Serve static files
#     yield
#     pass

# app = FastAPI(lifespan=lifespan)
app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your React app's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/function-call")
async def call_function(document_id: str = Body(...), function_name: str = Body(...), arguments: dict = Body(...)):
    print(arguments)
    outputFileName = document_id[:-5] + '_output.docx'
    try:
        editor = DocEditor(document_id, debug=True, outputFileName=outputFileName)
    except Exception as e:
        return HTTPException(status_code=400, detail=f'document_id must be a valid path (exception: {e})')
    
    if function_name == EDIT_PARAGRAPH:
        if len(arguments) != 2:
            raise HTTPException(status_code=400, detail=f"{EDIT_PARAGRAPH} takes 2 arguments but {len(arguments)} was provided")
        
        oldParagraph, newParagraph = arguments[OLD_PARAGRAPH], arguments[NEW_PARAGRAPH]
        editor.replaceText(oldParagraph, newParagraph, save=True)
    elif function_name == ADD_PARAGRAPH:
        pass
    elif function_name == DELETE_TEXT:
        pass
    else:
        raise HTTPException(status_code=400, detail=f"function_name must be in {[EDIT_PARAGRAPH, DELETE_TEXT, ADD_PARAGRAPH]}")

    # Read and return the output document as binary
    try:
        with open(outputFileName, 'rb') as doc_file:
            document_bytes = doc_file.read()
            base64_encoded = base64.b64encode(document_bytes).decode('utf-8')
            return {
                'content': base64_encoded
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read output document: {str(e)}")


@app.get("/token")
async def get_token():
    if not openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set in environment")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/realtime/sessions",
                headers={
                    "Authorization": f"Bearer {openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-realtime-preview-2024-12-17",
                    "voice": "verse",
                }
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=200)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


def main():
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))


if __name__ == "__main__":
    main()
