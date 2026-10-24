"""Offline execution of the real operational scripts and CI deployment body.

Run: python3 -m unittest discover -s pubrush-k8s/monopod/tests -v
Requires PyYAML for workflow/manifest syntax checks, not for production scripts.
Every kubectl/docker invocation is intercepted in a temporary directory.
"""

import copy
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "pubrush-k8s/monopod"
OLD = "docker.io/pubrush/backend@sha256:" + "b" * 64
OLD_MIGRATION = "docker.io/pubrush/backend@sha256:" + "c" * 64
NEW = "baptistebriziou/pubrush-backend@sha256:" + "a" * 64


FAKE = r'''#!/usr/bin/env python3
import copy, json, os, sys
from pathlib import Path
import yaml
p=Path(os.environ["MOCK_ROOT"])/"cluster.json"
s=json.loads(p.read_text())
raw=sys.argv[1:]
args=[]
context=None
namespace=None
i=0
while i < len(raw):
    if raw[i].startswith("--context="): context=raw[i].split("=",1)[1]
    elif raw[i] == "--context": context=raw[i+1]; i+=1
    elif raw[i] in ("-n","--namespace"): namespace=raw[i+1]; i+=1
    else: args.append(raw[i])
    i+=1
s["calls"].append({"args":args,"context":context,"namespace":namespace})
def save(): p.write_text(json.dumps(s))
def output(value): save(); print(json.dumps(value)); sys.exit(0)
def ready_pod(n):
    ns=s["namespace"]["metadata"]["name"]
    return {"metadata":{"name":f"backend-{n}","uid":f"uid-{n}","namespace":ns},
      "status":{"podIP":f"10.0.0.{n+1}","conditions":[{"type":"Ready","status":"True"}],
      "containerStatuses":[{"name":"backend","imageID":s["deployment"]["spec"]["template"]["spec"]["containers"][0]["image"] if "@" in s["deployment"]["spec"]["template"]["spec"]["containers"][0]["image"] else os.environ["OLD"]}],
      "initContainerStatuses":[{"name":"migration","imageID":s["deployment"]["spec"]["template"]["spec"]["initContainers"][0]["image"] if "@" in s["deployment"]["spec"]["template"]["spec"]["initContainers"][0]["image"] else os.environ["OLD_MIGRATION"]}]}}
def reconcile():
    s["pods"]={"items":[ready_pod(i) for i in range(s["deployment"]["spec"]["replicas"])]}
    s["endpoints"]={"subsets":[{"addresses":[{"ip":v["status"]["podIP"],"targetRef":{"kind":"Pod","name":v["metadata"]["name"],"uid":v["metadata"]["uid"],"namespace":v["metadata"]["namespace"]}} for v in s["pods"]["items"]]}]}
pattern=os.environ.get("MOCK_FAIL", "")
if pattern and pattern in " ".join(args) and (not os.environ.get("MOCK_FAIL_AFTER_MUTATION") or s["mutations"]):
    remaining=s.setdefault("failure_remaining",int(os.environ.get("MOCK_FAIL_TIMES","1000")))
    if remaining:
        s["failure_remaining"]-=1; save(); print("simulated kubectl error",file=sys.stderr); sys.exit(42)
if args[:2] == ["config","view"]: output(s["config"])
if context != "default" or namespace != s["namespace"]["metadata"]["name"]:
    save(); print("unsafe/missing explicit target",file=sys.stderr); sys.exit(43)
if args[0] == "get":
    kind=args[1]
    key={"namespace":"namespace","deployment":"deployment","hpa":"hpa","pods":"pods","endpoints":"endpoints"}[kind]
    if kind=="hpa" and args[2]=="pubrush-web-hpa": key="web_hpa"
    value=copy.deepcopy(s[key])
    fault=os.environ.get("MOCK_BAD", "") if s["mutations"] else ""
    if key=="pods":
        if fault=="zero-ready":
            for v in value["items"]: v["status"]["conditions"][0]["status"]="False"
        if fault in ("extra-ready","pending-extra"): value["items"].append(ready_pod(8))
        if fault=="pending-extra": value["items"][-1]["status"]["conditions"][0]["status"]="False"
        if fault in ("terminating","terminating-once"):
            if fault=="terminating" or not s.get("termination_seen"):
                pod=ready_pod(7); pod["metadata"]["deletionTimestamp"]="2026-10-24T00:00:00Z"; value["items"].append(pod)
                s["termination_seen"]=True
    if key=="endpoints" and fault:
        addresses=value["subsets"][0]["addresses"]
        if fault=="wrong-endpoint": addresses[0]["ip"]="10.8.8.8"
        if fault=="wrong-uid": addresses[0]["targetRef"]["uid"]="stale-pod"
        if fault=="not-ready-endpoint": value["subsets"][0]["notReadyAddresses"]=[addresses[0]]
        if fault=="no-endpoint": value["subsets"]=[]
    if key=="hpa" and fault=="wrong-hpa": value["spec"]["maxReplicas"]=5
    if key=="deployment" and fault=="wrong-strategy": value["spec"]["strategy"]={"type":"RollingUpdate"}
    output(value)
if args[0]=="patch":
    kind=args[1]; name=args[2]
    if name not in ("pubrush-backend","pubrush-backend-hpa"): sys.exit(44)
    if "--patch-file" in args: patch=yaml.safe_load(Path(args[args.index("--patch-file")+1]).read_text())
    else: patch=json.loads(args[args.index("--patch")+1])
    obj=s["deployment" if kind=="deployment" else "hpa"]
    if "--type=json" in args:
        assert patch[0]["op"]=="replace" and patch[0]["path"]=="/spec"
        obj["spec"]=patch[0]["value"]
    else:
        def merge(target,changes):
            for key,value in changes.items():
                if value is None: target.pop(key,None)
                elif isinstance(value,dict): merge(target.setdefault(key,{}),value)
                else: target[key]=value
        merge(obj,patch)
    s["mutations"]+=1; reconcile(); save(); print("patched"); sys.exit(0)
if args[:2]==["set","image"]:
    assert args[2]=="deployment/pubrush-backend"
    for pair in args[3:]:
        name,image=pair.split("=",1)
        group="containers" if name=="backend" else "initContainers"
        s["deployment"]["spec"]["template"]["spec"][group][0]["image"]=image
    s["mutations"]+=1; reconcile(); save(); print("images set"); sys.exit(0)
if args[:2]==["rollout","status"]: reconcile(); save(); print("rollout complete"); sys.exit(0)
save(); print("unexpected kubectl command: "+repr(args),file=sys.stderr); sys.exit(45)
'''

DOCKER = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
p=Path(os.environ["MOCK_ROOT"])/"cluster.json"
s=json.loads(p.read_text()); s.setdefault("docker_calls",[]).append(sys.argv[1:]); p.write_text(json.dumps(s))
sys.exit(1 if os.environ.get("MOCK_DOCKER_FAIL") else 0)
'''


class DeploymentScripts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)
        self.backups = self.path / "backups"
        self.bin = self.path / "bin"
        self.bin.mkdir()
        for name, content in (("kubectl", FAKE), ("docker", DOCKER), ("sleep", "#!/usr/bin/env bash\nexit 0\n")):
            file = self.bin / name
            file.write_text(content)
            file.chmod(0o755)
        self.env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ["PATH"],
                        MOCK_ROOT=str(self.path), PUBRUSH_BACKUP_DIR=str(self.backups),
                        RUNNER_TEMP=str(self.path), OLD=OLD, OLD_MIGRATION=OLD_MIGRATION,
                        PYTHONDONTWRITEBYTECODE="1")
        self.cluster = self.path / "cluster.json"
        self.reset()

    def reset(self, replicas=3, strategy=None, namespace="default"):
        strategy = strategy or {"type": "RollingUpdate", "rollingUpdate": {"maxSurge": "50%", "maxUnavailable": 2}}
        metadata = {"namespace": namespace}
        state = {
            "deployment": {"kind": "Deployment", "metadata": dict(metadata, name="pubrush-backend"),
                           "spec": {"replicas": replicas, "strategy": strategy,
                                    "template": {"spec": {"containers": [{"name": "backend", "image": "pubrush/backend:latest", "env": [{"name": "KEEP", "value": "yes"}]}],
                                                          "initContainers": [{"name": "migration", "image": "pubrush/migration:latest", "command": ["alembic", "upgrade", "head"]}]}}}},
            "hpa": {"apiVersion": "autoscaling/v2", "kind": "HorizontalPodAutoscaler",
                    "metadata": dict(metadata, name="pubrush-backend-hpa"),
                    "spec": {"minReplicas": 2, "maxReplicas": 7,
                             "scaleTargetRef": {"apiVersion": "apps/v1", "kind": "Deployment", "name": "pubrush-backend"},
                             "metrics": [{"type": "Resource", "resource": {"name": "cpu", "target": {"type": "Utilization", "averageUtilization": 63}}}],
                             "behavior": {"scaleDown": {"stabilizationWindowSeconds": 420}}}},
            "web_hpa": {"spec": {"minReplicas": 2, "maxReplicas": 4, "metrics": ["do-not-touch"]}},
            "namespace": {"metadata": {"name": namespace, "uid": "production-namespace-uid"}},
            "config": {"contexts": [{"name": "default", "context": {"cluster": "default"}}],
                       "clusters": [{"name": "default", "cluster": {"server": "https://127.0.0.1:6443"}}]},
            "calls": [], "mutations": 0, "pods": {"items": []}, "endpoints": {"subsets": []},
        }
        self.save(state)
        # Reconcile through the simulator, not a real Kubernetes connection.
        self.invoke_fake("rollout", "status", "deployment/pubrush-backend", namespace=namespace)
        state = self.read()
        state["calls"] = []
        self.save(state)

    def save(self, value):
        self.cluster.write_text(json.dumps(value))

    def read(self):
        return json.loads(self.cluster.read_text())

    def invoke_fake(self, *args, namespace="default"):
        subprocess.run([str(self.bin / "kubectl"), "--context=default", "-n", namespace, *args],
                       env=self.env, check=True, capture_output=True, text=True)

    def run_script(self, name, *args, ok=True, env=None):
        result = subprocess.run(["bash", str(SCRIPTS / name), *args], cwd=ROOT,
                                env=dict(self.env, **(env or {})), capture_output=True, text=True, timeout=15)
        if ok:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def activate(self, *args):
        self.run_script("switch-to-monopod.sh", *args)
        return self.backups / "latest_pre_monopod_backup.env"

    def snapshot(self):
        return json.loads((self.backups / "latest_pre_monopod_backup.env").read_text())

    def bad_snapshot(self, change):
        state = self.snapshot()
        change(state)
        file = self.path / "bad.json"
        file.write_text(json.dumps(state))
        return str(file)

    def run_ci(self, ok=True, env=None):
        workflow = yaml.safe_load((ROOT / ".github/workflows/deploy.yml").read_text())
        step = next(s for s in workflow["jobs"]["deploy"]["steps"] if "run" in s and "BUILD_DIGEST" in s.get("env", {}))
        body = step["run"]
        body = "set -euo pipefail\n" + body[body.index("# 4. Même"):]
        result = subprocess.run(["bash", "-c", body], cwd=ROOT, text=True, capture_output=True,
                                env=dict(self.env, BUILD_DIGEST="sha256:" + "a" * 64, **(env or {})), timeout=15)
        self.assertEqual(result.returncode == 0, ok, result.stdout + result.stderr)
        return result

    def test_activation_zero_terminating_and_zero_not_ready(self):
        web = self.read()["web_hpa"]
        self.activate()
        state = self.read()
        self.assertEqual(state["deployment"]["spec"]["strategy"], {"type": "Recreate"})
        self.assertEqual(state["deployment"]["spec"]["replicas"], 1)
        self.assertEqual((state["hpa"]["spec"]["minReplicas"], state["hpa"]["spec"]["maxReplicas"]), (1, 1))
        self.assertEqual(state["web_hpa"], web)

    def test_repeated_activation_preserves_original_baseline(self):
        self.activate()
        baseline = self.snapshot()
        self.activate()
        self.assertEqual(self.snapshot(), baseline)
        self.assertEqual(baseline["deployment"]["replicas"], 3)

    def test_waits_for_terminating_pod(self):
        self.run_script("switch-to-monopod.sh", env={"MOCK_BAD": "terminating-once"})
        self.assertTrue(self.read()["termination_seen"])

    def test_convergence_rejects_every_invalid_invariant(self):
        for fault in ("zero-ready", "extra-ready", "pending-extra", "wrong-endpoint", "wrong-uid",
                      "not-ready-endpoint", "no-endpoint", "wrong-hpa", "wrong-strategy", "terminating"):
            with self.subTest(fault=fault):
                self.reset()
                self.run_script("switch-to-monopod.sh", ok=False, env={"MOCK_BAD": fault})

    def test_real_kubectl_read_errors_abort_before_mutation(self):
        for command in ("config view", "get namespace", "get deployment", "get hpa", "get pods"):
            with self.subTest(command=command):
                self.reset()
                self.run_script("switch-to-monopod.sh", ok=False, env={"MOCK_FAIL": command})
                self.assertEqual(self.read()["mutations"], 0)

    def test_real_kubectl_errors_in_convergence_are_not_hidden(self):
        for command in ("get pods", "get endpoints", "rollout status", "get deployment", "get hpa"):
            with self.subTest(command=command):
                self.reset()
                self.run_script("switch-to-monopod.sh", ok=False,
                                env={"MOCK_FAIL": command, "MOCK_FAIL_AFTER_MUTATION": "1"})

    def test_mutation_failure_aborts(self):
        self.run_script("switch-to-monopod.sh", ok=False, env={"MOCK_FAIL": "patch hpa"})
        self.assertEqual(self.read()["mutations"], 0)

    def test_wrong_cluster_aborts(self):
        state = self.read()
        state["config"]["contexts"][0]["context"]["cluster"] = "other"
        self.save(state)
        self.run_script("switch-to-monopod.sh", ok=False)
        self.assertEqual(self.read()["mutations"], 0)

    def test_explicit_non_default_namespace_is_respected(self):
        self.reset(namespace="production")
        self.activate("--namespace", "production")
        self.assertEqual(self.snapshot()["target"]["namespace"], "production")
        self.assertTrue(all(c["namespace"] == "production" for c in self.read()["calls"] if c["args"][0] != "config"))

    def test_restore_exact_parameters_without_old_images_or_web_changes(self):
        before = self.read()
        statefile = self.activate()
        current = self.read()
        current["deployment"]["spec"]["template"]["spec"]["containers"][0]["image"] = NEW
        current["deployment"]["spec"]["template"]["spec"]["initContainers"][0]["image"] = NEW
        current["hpa"]["spec"]["extraToRemove"] = True
        self.save(current)
        template = copy.deepcopy(current["deployment"]["spec"]["template"])
        self.run_script("restore-multipod.sh", "--from-env", str(statefile))
        restored = self.read()
        self.assertEqual(restored["deployment"]["spec"]["replicas"], before["deployment"]["spec"]["replicas"])
        self.assertEqual(restored["deployment"]["spec"]["strategy"], before["deployment"]["spec"]["strategy"])
        self.assertEqual(restored["hpa"]["spec"], before["hpa"]["spec"])
        self.assertEqual(restored["deployment"]["spec"]["template"], template)
        self.assertEqual(restored["web_hpa"], before["web_hpa"])

    def test_restore_saved_recreate(self):
        self.reset(replicas=1, strategy={"type": "Recreate"})
        state = self.read()
        state["hpa"]["spec"].update(minReplicas=1, maxReplicas=1)
        self.save(state)
        file = self.activate()
        self.run_script("restore-multipod.sh", "--from-env", str(file))
        self.assertEqual(self.read()["deployment"]["spec"]["strategy"], {"type": "Recreate"})

    def test_restore_requires_explicit_snapshot(self):
        self.run_script("restore-multipod.sh", ok=False)
        self.assertEqual(self.read()["mutations"], 0)

    def test_snapshot_target_contradictions_are_rejected_by_both_consumers(self):
        self.activate()
        for key in ("context", "namespace", "cluster", "namespace_uid", "server"):
            for script in ("restore-multipod.sh", "rollback-backend.sh"):
                with self.subTest(key=key, script=script):
                    file = self.bad_snapshot(lambda s: s["target"].__setitem__(key, "other"))
                    mutations = self.read()["mutations"]
                    self.run_script(script, "--from-env", file, ok=False)
                    self.assertEqual(self.read()["mutations"], mutations)

    def test_invalid_and_executable_backups_never_execute(self):
        self.activate()
        marker = self.path / "must-not-exist"
        for payload in ("not json", f'TARGET_CONTEXT="$(touch {marker})"', '{"version":1,"version":2}', '{}'):
            for script in ("restore-multipod.sh", "rollback-backend.sh"):
                with self.subTest(payload=payload, script=script):
                    file = self.path / "invalid.env"
                    file.write_text(payload)
                    count = self.read()["mutations"]
                    self.run_script(script, "--from-env", str(file), ok=False)
                    self.assertEqual(self.read()["mutations"], count)
        self.assertFalse(marker.exists())

    def test_invalid_resource_and_strategy_backups_rejected(self):
        self.activate()
        changes = (lambda s: s["hpa"]["metadata"].__setitem__("name", "pubrush-web-hpa"),
                   lambda s: s["hpa"]["metadata"].__setitem__("namespace", "elsewhere"),
                   lambda s: s["hpa"]["spec"]["scaleTargetRef"].__setitem__("name", "pubrush-web"),
                   lambda s: s["deployment"].__setitem__("replicas", -1),
                   lambda s: s["deployment"]["strategy"].__setitem__("type", "invalid"),
                   lambda s: s["deployment"].__setitem__("template", {}),
                   lambda s: s["images"].__setitem__("backend", "pubrush/backend:latest"))
        for change in changes:
            file = self.bad_snapshot(change)
            count = self.read()["mutations"]
            self.run_script("restore-multipod.sh", "--from-env", file, ok=False)
            self.assertEqual(self.read()["mutations"], count)

    def test_missing_snapshot_aborts(self):
        for script in ("restore-multipod.sh", "rollback-backend.sh"):
            self.run_script(script, "--from-env", str(self.path / "missing.json"), ok=False)
        self.assertEqual(self.read()["mutations"], 0)

    def test_rollback_restores_distinct_digests_and_keeps_monopod(self):
        file = self.activate()
        self.run_script("rollback-backend.sh", "--from-env", str(file))
        spec = self.read()["deployment"]["spec"]
        self.assertEqual(spec["template"]["spec"]["containers"][0]["image"], OLD)
        self.assertEqual(spec["template"]["spec"]["initContainers"][0]["image"], OLD_MIGRATION)
        self.assertEqual(spec["strategy"], {"type": "Recreate"})
        self.assertEqual(spec["replicas"], 1)

    def test_rollback_possible_without_ready_pod(self):
        file = self.activate()
        state = self.read()
        state["pods"]["items"][0]["status"]["conditions"][0]["status"] = "False"
        state["endpoints"] = {"subsets": []}
        self.save(state)
        self.run_script("rollback-backend.sh", "--from-env", str(file))

    def test_rollback_rejects_mutable_reference_and_multipod_target(self):
        self.activate()
        count = self.read()["mutations"]
        self.run_script("rollback-backend.sh", "--image", "pubrush/backend:latest", ok=False)
        self.assertEqual(self.read()["mutations"], count)
        self.reset()
        self.run_script("rollback-backend.sh", "--image", OLD, ok=False)
        self.assertEqual(self.read()["mutations"], 0)

    def test_restore_kubectl_failure_aborts(self):
        file = self.activate()
        count = self.read()["mutations"]
        self.run_script("restore-multipod.sh", "--from-env", str(file), ok=False,
                        env={"MOCK_FAIL": "get hpa"})
        self.assertEqual(self.read()["mutations"], count)

    def test_rollback_kubectl_failure_aborts(self):
        file = self.activate()
        count = self.read()["mutations"]
        self.run_script("rollback-backend.sh", "--from-env", str(file), ok=False,
                        env={"MOCK_FAIL": "set image"})
        self.assertEqual(self.read()["mutations"], count)

    def test_ci_nominal_uses_both_build_digests_and_shared_invariants(self):
        self.activate()
        self.run_ci()
        spec = self.read()["deployment"]["spec"]["template"]["spec"]
        self.assertEqual(spec["containers"][0]["image"], NEW)
        self.assertEqual(spec["initContainers"][0]["image"], NEW)
        self.assertTrue((self.path / "pubrush-predeploy.json").is_file())
        self.assertEqual(len(self.read()["docker_calls"]), 2)

    def test_ci_refuses_unrecoverable_previous_image_before_mutation(self):
        self.activate()
        count = self.read()["mutations"]
        self.run_ci(ok=False, env={"MOCK_DOCKER_FAIL": "1"})
        self.assertEqual(self.read()["mutations"], count)

    def test_ci_refuses_non_monopod_target(self):
        self.run_ci(ok=False)
        self.assertEqual(self.read()["mutations"], 0)

    def test_ci_rollout_failure_restores_previous_distinct_digests(self):
        file = self.activate()
        self.run_script("rollback-backend.sh", "--from-env", str(file))
        self.run_ci(ok=False, env={"MOCK_FAIL": "rollout status", "MOCK_FAIL_AFTER_MUTATION": "1", "MOCK_FAIL_TIMES": "1"})
        spec = self.read()["deployment"]["spec"]["template"]["spec"]
        self.assertEqual(spec["containers"][0]["image"], OLD)
        self.assertEqual(spec["initContainers"][0]["image"], OLD_MIGRATION)

    def test_ci_convergence_kubectl_error_is_not_hidden_in_error_handler(self):
        self.activate()
        # Fail on the first read after the new images are installed, not during preflight.
        state = self.read()
        state["mutations"] = 0
        self.save(state)
        self.run_ci(ok=False, env={"MOCK_FAIL": "get endpoints", "MOCK_FAIL_AFTER_MUTATION": "1", "MOCK_FAIL_TIMES": "1"})
        spec = self.read()["deployment"]["spec"]["template"]["spec"]
        self.assertEqual(spec["containers"][0]["image"], OLD)
        self.assertEqual(spec["initContainers"][0]["image"], OLD_MIGRATION)

    def test_bash_and_workflow_syntax_and_digest_wiring(self):
        for file in SCRIPTS.glob("*.sh"):
            subprocess.run(["bash", "-n", str(file)], check=True)
        workflow = yaml.safe_load((ROOT / ".github/workflows/deploy.yml").read_text())
        build = workflow["jobs"]["build-and-push"]
        self.assertEqual(build["outputs"]["image_digest"], "${{ steps.build_backend.outputs.digest }}")
        self.assertIn("build_backend", [s.get("id") for s in build["steps"]])
        self.assertFalse(workflow["concurrency"]["cancel-in-progress"])
        for job in workflow["jobs"].values():
            for step in job["steps"]:
                if "run" in step:
                    run = re.sub(r"\$\{\{.*?\}\}", "placeholder", step["run"])
                    subprocess.run(["bash", "-n"], input=run, text=True, check=True)


if __name__ == "__main__":
    unittest.main()
