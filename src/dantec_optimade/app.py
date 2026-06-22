from fastapi import FastAPI

from dantec_optimade.graphql_schema import graphql_router

app = FastAPI(title="DANTEc OPTIMADE Federation")
app.include_router(graphql_router, prefix="/graphql")
