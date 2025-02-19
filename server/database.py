import os
import json
from typing import List


rootPath = os.getenv('PATH_TO_ROOT')
class DBMock:
    path = os.path.join(rootPath, 'data/userDocumentTable.json')
    
    def __init__(self):
        try:
            with open(self.path, 'r') as f:
                self.documetsMap = json.load(f)
        except:
            self.documetsMap = {}
    
    def add(self, documentID: str, userEmail: str):
        if userEmail not in self.documetsMap:
            self.documetsMap[userEmail] = []
        
        if documentID in self.documetsMap[userEmail]:
            return

        self.documetsMap[userEmail].append(documentID)
        with open(self.path, 'w') as f:
            json.dump(self.documetsMap, f)
    
    def getDocuments(self, userEmail: str) -> List[str]:
        if userEmail not in self.documetsMap:
            return []
        return self.documetsMap[userEmail]
