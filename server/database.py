import json
from typing import List

class DBMock:
    path = './userDocumentTable.json'
    
    def __init__(self):
        try:
            with open(self.path, 'r') as f:
                self.documetsMap = json.load(f)
        except:
            self.documetsMap = {}
    
    def add(self, documentID: str, userEmail: str):
        if userEmail not in self.documetsMap:
            self.documetsMap[userEmail] = []
        if documentID not in self.documetsMap[userEmail]:
            self.documetsMap[userEmail].append(documentID)

        with open(self.path, 'w') as f:
            json.dump(self.documetsMap, f)
    
    def getDocuments(self, userEmail: str) -> List[str]:
        if userEmail not in self.documetsMap:
            return []
        return self.documetsMap[userEmail]
