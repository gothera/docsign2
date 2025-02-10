from contextlib import asynccontextmanager
from document import DocumentStructure, FormField
from documentEditor import DocEditor
from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import base64
import httpx
import json
import os
from typing import List
import mailService



openai_api_key = os.getenv('OPENAI_API_KEY')

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
    allow_origins=['http://localhost:3000'],  # Your React app's origin
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.post('/function-call')
async def callFunction(document_id: str = Body(...), function_name: str = Body(...), arguments: dict = Body(...)):
    print(arguments)
    outputFileName = document_id[:-5] + '_output.docx'
    try:
        editor = DocEditor(document_id, debug=True, outputFileName=outputFileName)
    except Exception as e:
        return HTTPException(status_code=400, detail=f'document_id must be a valid path (exception: {e})')
    
    if function_name == EDIT_PARAGRAPH:
        if len(arguments) != 2:
            raise HTTPException(status_code=400, detail=f'{EDIT_PARAGRAPH} takes 2 arguments but {len(arguments)} was provided')
        
        oldParagraph, newParagraph = arguments[OLD_PARAGRAPH], arguments[NEW_PARAGRAPH]
        editor.replaceText(oldParagraph, newParagraph, save=True)
    elif function_name == ADD_PARAGRAPH:
        pass
    elif function_name == DELETE_TEXT:
        pass
    else:
        raise HTTPException(status_code=400, detail=f'function_name must be in {[EDIT_PARAGRAPH, DELETE_TEXT, ADD_PARAGRAPH]}')

    try:
        with open(outputFileName, 'rb') as file:
            documentBytes = file.read()
            base64Encoded = base64.b64encode(documentBytes).decode('utf-8')
        return JSONResponse(content={'content': base64Encoded}, status_code=200)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to read output document: {str(e)}')


@app.post('/request-signature')
async def requestSignature(
    documentId: str = Body(..., alias='document_id', description='Document Path for now'),
    userId: str = Body(..., alias='user_id', description='email for now'),
    formFields: List = Body(..., alias='form_field')
):
    try: 
        if not formFields:
            raise HTTPException(status_code=400, detail='Form fields required')

        path = documentId.rsplit('.', 1)[0]
        jsonPath = path + '.json'
        with open(jsonPath, 'w') as jsonFile:
            json.dump(formFields, jsonFile)

        encodedPath = base64.b64encode(path.encode('utf-8')).decode('utf-8')

        await mailService.sendMail(userId, encodedPath)

        return JSONResponse(content={'id': encodedPath}, status_code=200)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error: {str(e)}')


@app.get('/document')
async def get_document(
    id: str = Query(..., alias='id', description='The ID of the document')
):
    try:
        # Decode the document_id back to the JSON file path
        path = base64.b64decode(id.encode('utf-8')).decode('utf-8')
        jsonPath, docxPath = path + '.json', path + '.docx'

        # Load form fields from JSON
        if not os.path.exists(jsonPath) or not os.path.exists(docxPath):
            raise ValueError(f'Document Id {id} decoded {docxPath} was not found')

        with open(jsonPath, 'r') as file:
            formFields = [field for field in json.load(file)]
        with open(docxPath, 'rb') as file:
            documentBytes = file.read()
            documentBase64Encoded = base64.b64encode(documentBytes).decode('utf-8')

        return {'id': docxPath, 'document': documentBase64Encoded, 'form_fields': formFields}
        # return DocumentStructure(
        #     id=docxPath,
        #     document=documentBase64Encoded,
        #     form_fields=formFields
        # )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error retrieving document: {str(e)}')

@app.post("/sign")
async def sign(user: str = Body(...), pdf: str = Body(...)):
    print("Sign endpoint: args: ", user, pdf)
    try:
        if not pdf:
            raise ValueError("No content found in the request body.")

        try:
            documentBytes = base64.b64decode(pdf)
        except base64.binascii.Error as e:
            raise ValueError(f"Invalid base64 encoding in the document: {e}")

        outputFileName = "reconstructed_document.pdf"
        if os.path.exists(outputFileName):
            os.remove(outputFileName)

        with open(outputFileName, 'wb') as file:
            file.write(documentBytes)
        
        return {"message": f"PDF has been reconstructed and saved as {outputFileName}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error retrieving document: {str(e)}')



@app.get('/token')
async def getToken():
    if not openai_api_key:
        raise HTTPException(status_code=500, detail='OPENAI_API_KEY not set in environment')

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://api.openai.com/v1/realtime/sessions',
                headers={
                    'Authorization': f'Bearer {openai_api_key}',
                    'Content-Type': 'application/json',
                },
                json={
                    'model': 'gpt-4o-realtime-preview-2024-12-17',
                    'voice': 'verse',
                }
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=200)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


def main():
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.getenv('PORT', 8000)))


if __name__ == '__main__':
    main()
