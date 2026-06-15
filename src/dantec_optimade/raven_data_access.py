import requests


#  ---------------------------------------------------------------------------------------------------------------------
#  Functions
#  ---------------------------------------------------------------------------------------------------------------------
class RavenDBClient:
    def __init__(self, base_url, database):
        self.base_url = base_url
        self.database = database
        self.query_url = f"{self.base_url}/databases/{self.database}/queries"
        self.docs_url = f"{self.base_url}/databases/{self.database}/docs"
        self.headers = {"Accept-Encoding": "identity"}

    def query(self, query_string):
        payload = {"Query": query_string}
        response = requests.post(self.query_url, json=payload, headers=self.headers)

        if response.status_code == 200:
            try:
                return response.json()
            except ValueError:
                print("Response is not valid JSON")
                return None
        else:
            print(f"Request failed with status code {response.status_code}")
            return None

    # -------------------------------------------------------------------------------------------------
    # Get document by ID
    # -------------------------------------------------------------------------------------------------
    def get_document(self, doc_id):
        params = {"id": doc_id}
        response = requests.get(self.docs_url, params=params, headers=self.headers)

        if response.status_code == 200:
            try:
                return response.json()
            except ValueError:
                print("Response is not valid JSON")
                return None
        elif response.status_code == 404:
            print("Document not found")
            return None
        else:
            print(f"Request failed with status code {response.status_code}")
            return None

    # -------------------------------------------------------------------------------------------------
    # Insert (or update) single document
    # -------------------------------------------------------------------------------------------------

    def insert_single_document(self, data):

        params = {'id': data['id']}

        material_data = {
            'provider': data['provider'],
            'chemical_formula_reduced': data['chemical_formula_reduced'],
            'chemical_formula_hill': data['chemical_formula_hill'],
            'elements': data['elements'],
            'nelements': data['nelements'],
            'nsites': data['nsites'],
            'dimension_types': data['dimension_types'],
            'nperiodic_dimensions': data['nperiodic_dimensions'],
            'last_modified': data['last_modified'],
        }

        response = requests.put(self.docs_url, params=params, json=material_data, headers=self.headers)

        if response.status_code in (200, 201):
            try:
                response.json()
            except ValueError:
                print("Response is not valid JSON")
        else:
            print(f"Insert failed with status code {response.status_code}")

        return

    # -------------------------------------------------------------------------------------------------
    # Insert (or update) document
    # -------------------------------------------------------------------------------------------------
    def insert_document(self, data):

        for item in data:

            params = {'id': item['id']}

            material_data = {
                'provider': item['provider'],
                'chemical_formula_reduced': item['chemical_formula_reduced'],
                'chemical_formula_hill': item['chemical_formula_hill'],
                'elements': item['elements'],
                'nelements': item['nelements'],
                'nsites': item['nsites'],
                'dimension_types': item['dimension_types'],
                'nperiodic_dimensions': item['nperiodic_dimensions'],
                'last_modified': item['last_modified'],
            }

            response = requests.put(self.docs_url, params=params, json=material_data, headers=self.headers)

            if response.status_code in (200, 201):
                try:
                    response.json()
                except ValueError:
                    print("Response is not valid JSON")
            else:
                print(f"Insert failed with status code {response.status_code}")
        return

    # -------------------------------------------------------------------------------------------------
    # Delete document
    # -------------------------------------------------------------------------------------------------
    def delete_document(self, doc_id):
        params = {"id": doc_id}
        response = requests.delete(self.docs_url, params=params, headers=self.headers)

        if response.status_code == 204:
            print("Document deleted successfully")
            return True
        elif response.status_code == 404:
            print("Document not found")
            return False
        else:
            print(f"Delete failed with status code {response.status_code}")
            return False
