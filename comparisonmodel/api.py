import importlib.util
import os

from flask import Flask, jsonify, request
from google.cloud import bigquery


app = Flask(__name__)

PROJECT_ID = "pacey32-agency"


def load_modelrunner():
    path = os.path.join(
        os.path.dirname(__file__),
        "07_modelrunner.py"
    )

    spec = importlib.util.spec_from_file_location(
        "modelrunner",
        path
    )

    if (
        spec is None
        or spec.loader is None
    ):
        raise ImportError(
            "Unable to load 07_modelrunner.py"
        )

    modelrunner = (
        importlib.util.module_from_spec(
            spec
        )
    )

    spec.loader.exec_module(
        modelrunner
    )

    return modelrunner


modelrunner = load_modelrunner()


@app.get("/health")
def health():
    return jsonify({
        "status": "ok"
    })


@app.post("/generate-comparisons")
def generate_comparisons():
    try:
        payload = (
            request.get_json(
                silent=True
            )
            or {}
        )

        player_id = payload.get(
            "playerId"
        )

        if player_id is None:
            return jsonify({
                "error":
                    "playerId is required"
            }), 400

        try:
            player_id = int(
                player_id
            )

        except (
            TypeError,
            ValueError,
        ):
            return jsonify({
                "error":
                    "playerId must be an integer"
            }), 400

        client = bigquery.Client(
            project=PROJECT_ID
        )

        result = (
            modelrunner.run_player(
                client,
                player_id,
                write_to_bigquery=True
            )
        )

        return jsonify({
            "playerId":
                player_id,

            "comparisons":
                result.to_dict(
                    orient="records"
                )
        })

    except Exception as error:
        print(
            f"Comparison API error: "
            f"{type(error).__name__}: "
            f"{error}"
        )

        return jsonify({
            "error":
                str(error)
        }), 500


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(
            os.getenv(
                "PORT",
                "8080"
            )
        )
    )