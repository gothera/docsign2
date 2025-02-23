import os

introduction = '''I will give you the code. Please wait to tell you what I wnat to add or modify and try to be concise, tell me just wnat to add or modify, do not repete the hole text. thanks
btw, we are using a separat python server as backend for the rest api and it is available at localhost 8000, but i didn't gave you the code for that
'''

def collectReactFiles():
    # Define the output file name
    outputFileName = "combinedReactCode.txt"
    
    # Define file extensions to look for
    targetExtensions = ('.js', '.jsx', '.html', '.css', '.cjs', '.json')
    
    # Initialize content list
    allCodeContent = [introduction]
    
    # Get files from root directory
    for fileName in os.listdir('.'):
        if fileName == 'package-lock.json':  # Skip package-lock.json
            continue
        if fileName.endswith(targetExtensions):
            try:
                with open(fileName, 'r', encoding='utf-8') as file:
                    fileContent = file.read()
                    allCodeContent.append(f"\n\n{'='*50}\nFile: {fileName}\n{'='*50}\n\n{fileContent}")
            except Exception as e:
                allCodeContent.append(f"\n\n{'='*50}\nFile: {fileName}\n{'='*50}\n\nError reading file: {str(e)}")

    # Get files from client folder if it exists
    clientFolder = 'client'
    if os.path.exists(clientFolder):
        for root, _, files in os.walk(clientFolder):
            for fileName in files:
                if fileName.endswith(targetExtensions):
                    fullPath = os.path.join(root, fileName)
                    try:
                        with open(fullPath, 'r', encoding='utf-8') as file:
                            fileContent = file.read()
                            allCodeContent.append(f"\n\n{'='*50}\nFile: {fullPath}\n{'='*50}\n\n{fileContent}")
                    except Exception as e:
                        allCodeContent.append(f"\n\n{'='*50}\nFile: {fullPath}\n{'='*50}\n\nError reading file: {str(e)}")

    # Write all content to output file
    try:
        with open(outputFileName, 'w', encoding='utf-8') as outputFile:
            outputFile.write("".join(allCodeContent))
        print(f"Successfully created {outputFileName} with all relevant code")
    except Exception as e:
        print(f"Error writing to output file: {str(e)}")

if __name__ == "__main__":
    collectReactFiles()