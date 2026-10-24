#!/usr/bin/env python3
"""Validate deployment snapshots and convergence using only the Python standard library.

Snapshots contain data, never shell assignments. Deployment restoration deliberately
excludes spec.template, so it cannot restore old images, commands or environment.
"""

import json
import re
import sys
from pathlib import Path


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "Duplicate JSON key: " + key)
            result[key] = value
        return result
    return json.loads(Path(path).read_text(), object_pairs_hook=unique_pairs)


def named(items, name):
    matches = [item for item in items if item.get("name") == name]
    require(len(matches) == 1, "Expected exactly one object named " + name)
    return matches[0]


def positive(value):
    return type(value) is int and value > 0


def valid_strategy(strategy):
    require(isinstance(strategy, dict), "Invalid deployment strategy")
    require(strategy.get("type") in ("RollingUpdate", "Recreate"), "Unknown strategy")
    require(set(strategy) <= {"type", "rollingUpdate"}, "Unknown strategy fields")
    if strategy["type"] == "Recreate":
        require(not strategy.get("rollingUpdate"), "Recreate cannot have rollingUpdate settings")
    else:
        rolling = strategy.get("rollingUpdate", {})
        require(isinstance(rolling, dict), "Invalid rollingUpdate settings")
        require(set(rolling) == {"maxSurge", "maxUnavailable"}, "Incomplete rollingUpdate settings")
        for value in rolling.values():
            require((type(value) is int and value >= 0) or
                    (isinstance(value, str) and re.fullmatch(r"\d+%", value)),
                    "Invalid rollingUpdate limit")


def valid_hpa(spec):
    require(isinstance(spec, dict), "Invalid HPA spec")
    require(positive(spec.get("minReplicas")) and positive(spec.get("maxReplicas")), "Invalid HPA bounds")
    require(spec["minReplicas"] <= spec["maxReplicas"], "Contradictory HPA bounds")
    target = spec.get("scaleTargetRef", {})
    require(target.get("name") == "pubrush-backend" and target.get("kind") == "Deployment"
            and target.get("apiVersion") == "apps/v1", "HPA must target only pubrush-backend")


def image_ref(value):
    value = value.removeprefix("docker-pullable://")
    require(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:/-]*@sha256:[a-f0-9]{64}", value),
            "Expected a recoverable repository@sha256 image reference")
    return value


def object_identity(obj, kind, name, namespace):
    require(obj.get("kind") == kind and obj.get("metadata", {}).get("name") == name
            and obj["metadata"].get("namespace") == namespace, "Invalid backup resource identity")


def load_state(path):
    state = read(path)
    require(isinstance(state, dict) and set(state) ==
            {"version", "target", "deployment", "hpa", "images"}, "Invalid snapshot fields/version")
    require(type(state["version"]) is int and state["version"] == 1, "Unsupported snapshot version")
    target = state["target"]
    require(isinstance(target, dict) and set(target) ==
            {"context", "namespace", "cluster", "server", "namespace_uid"}, "Invalid snapshot target")
    require(all(isinstance(v, str) and v.strip() for v in target.values()), "Empty snapshot target")
    deployment = state["deployment"]
    require(set(deployment) == {"replicas", "strategy"} and positive(deployment["replicas"]),
            "Invalid saved Deployment parameters")
    valid_strategy(deployment["strategy"])
    hpa = state["hpa"]
    require(set(hpa) == {"apiVersion", "kind", "metadata", "spec"}, "Invalid saved HPA")
    require(hpa["apiVersion"] == "autoscaling/v2", "Unsupported HPA API")
    object_identity(hpa, "HorizontalPodAutoscaler", "pubrush-backend-hpa", target["namespace"])
    require(set(hpa["metadata"]) == {"name", "namespace"}, "Unexpected saved HPA metadata")
    valid_hpa(hpa["spec"])
    require(set(state["images"]) == {"backend", "migration"}, "Missing saved images")
    for value in state["images"].values():
        image_ref(value)
    return state


def ready_pods(pods):
    return [pod for pod in pods["items"] if not pod["metadata"].get("deletionTimestamp")
            and any(c.get("type") == "Ready" and c.get("status") == "True"
                    for c in pod.get("status", {}).get("conditions", []))]


def resolve_image(deployment, pods, container, init=False):
    group = "initContainers" if init else "containers"
    statuses = "initContainerStatuses" if init else "containerStatuses"
    spec = named(deployment["spec"]["template"]["spec"][group], container)["image"]
    if "@sha256:" in spec:
        return image_ref(spec)
    refs = set()
    for pod in ready_pods(pods):
        value = named(pod["status"].get(statuses, []), container).get("imageID", "")
        refs.add(image_ref(value))
    require(len(refs) == 1, "Cannot resolve one stable previous image for " + container)
    return refs.pop()


def capture(directory):
    directory = Path(directory)
    target = read(directory / "target.json")
    deployment = read(directory / "deployment.json")
    hpa = read(directory / "hpa.json")
    pods = read(directory / "pods.json")
    object_identity(deployment, "Deployment", "pubrush-backend", target["namespace"])
    object_identity(hpa, "HorizontalPodAutoscaler", "pubrush-backend-hpa", target["namespace"])
    return {
        "version": 1, "target": target,
        "deployment": {key: deployment["spec"][key] for key in ("replicas", "strategy")},
        "hpa": {"apiVersion": hpa["apiVersion"], "kind": hpa["kind"],
                "metadata": {"name": "pubrush-backend-hpa", "namespace": target["namespace"]},
                "spec": hpa["spec"]},
        "images": {"backend": resolve_image(deployment, pods, "backend"),
                   "migration": resolve_image(deployment, pods, "migration", init=True)},
    }


def verify(directory, expected):
    directory = Path(directory)
    deployment, hpa, pods, endpoints = [read(directory / (name + ".json"))
                                       for name in ("deployment", "hpa", "pods", "endpoints")]
    require(not any(p["metadata"].get("deletionTimestamp") for p in pods["items"]),
            "Terminating backend pods remain")
    if expected == "monopod":
        replicas = 1
        require(deployment["spec"]["strategy"].get("type") == "Recreate", "Expected Recreate")
        require(hpa["spec"]["minReplicas"] == hpa["spec"]["maxReplicas"] == 1, "Expected HPA 1/1")
    else:
        state = load_state(expected)
        replicas = state["deployment"]["replicas"]
        require(deployment["spec"]["strategy"] == state["deployment"]["strategy"], "Strategy was not restored exactly")
        require(hpa["spec"] == state["hpa"]["spec"], "HPA was not restored exactly")
    require(deployment["spec"]["replicas"] == replicas, "Unexpected replica target")
    ready = ready_pods(pods)
    require(len(pods["items"]) == len(ready) == replicas, "Unexpected backend pod count/readiness")
    addresses = [a for s in endpoints.get("subsets", []) for a in s.get("addresses", [])]
    require(not any(s.get("notReadyAddresses") for s in endpoints.get("subsets", [])), "Non-ready endpoints remain")
    require(len(addresses) == replicas, "Unexpected ready endpoint count")
    actual = set()
    for address in addresses:
        ref = address.get("targetRef", {})
        require(ref.get("kind") == "Pod", "Endpoint does not reference a Pod")
        actual.add((address["ip"], ref.get("name"), ref.get("uid"), ref.get("namespace")))
    wanted = {(p["status"]["podIP"], p["metadata"]["name"], p["metadata"]["uid"],
               p["metadata"]["namespace"]) for p in ready}
    require(actual == wanted, "Ready endpoints do not match Ready backend pods")


def monopod_config(directory):
    deployment = read(Path(directory) / "deployment.json")
    hpa = read(Path(directory) / "hpa.json")
    require(deployment["spec"]["replicas"] == 1 and
            deployment["spec"]["strategy"].get("type") == "Recreate" and
            hpa["spec"]["minReplicas"] == hpa["spec"]["maxReplicas"] == 1,
            "Rollback requires replica target 1, Recreate and HPA 1/1")


def main(args):
    command = args[0]
    if command == "target":
        config, ns = read(args[1]), read(args[2])
        context, namespace, cluster = args[3:6]
        require(all((context, namespace, cluster)), "Empty Kubernetes target")
        actual = named(config["contexts"], context)["context"]
        require(actual["cluster"] == cluster, "Context points to an unexpected cluster")
        server = named(config["clusters"], cluster)["cluster"]["server"]
        require(ns["metadata"]["name"] == namespace and ns["metadata"].get("uid"), "Wrong namespace identity")
        print(json.dumps(dict(context=context, namespace=namespace, cluster=cluster,
                              server=server, namespace_uid=ns["metadata"]["uid"])))
    elif command == "capture":
        print(json.dumps(capture(args[1]), indent=2))
    elif command == "validate":
        require(load_state(args[1])["target"] == read(args[2]), "Snapshot contradicts requested context/cluster/namespace")
    elif command == "deployment-patch":
        parameters = load_state(args[1])["deployment"]
        if parameters["strategy"]["type"] == "Recreate":
            parameters["strategy"]["rollingUpdate"] = None
        print(json.dumps({"spec": parameters}))
    elif command == "hpa-patch":
        print(json.dumps([{"op": "replace", "path": "/spec", "value": load_state(args[1])["hpa"]["spec"]}]))
    elif command == "image":
        print(load_state(args[1])["images"][args[2]])
    elif command == "image-ref":
        print(image_ref(args[1]))
    elif command == "terminating":
        print(sum(bool(p["metadata"].get("deletionTimestamp")) for p in json.load(sys.stdin)["items"]))
    elif command == "verify":
        verify(args[1], args[2])
        print("Convergence validée : pods/endpoints correspondants, HPA et stratégie conformes.")
    elif command == "monopod-config":
        monopod_config(args[1])
    elif command == "images-match":
        deployment = read(args[1])
        spec = deployment["spec"]["template"]["spec"]
        require(named(spec["containers"], "backend")["image"] == args[2]
                and named(spec["initContainers"], "migration")["image"] == args[3], "Unexpected deployed image references")
    else:
        raise ValueError("Unknown command " + command)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except (ValueError, KeyError, TypeError, IndexError, OSError) as exc:
        sys.exit("ERREUR BLOQUANTE : " + str(exc))
