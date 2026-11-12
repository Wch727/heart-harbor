import json
import sys
from pathlib import Path

import torch
from transformers import BertForSequenceClassification, BertTokenizerFast


def send(payload):
    print(json.dumps(payload, ensure_ascii=True), flush=True)


def main():
    model_dir = Path(sys.argv[1])
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    tokenizer = BertTokenizerFast.from_pretrained(model_dir, local_files_only=True)
    model, loading = BertForSequenceClassification.from_pretrained(
        model_dir, local_files_only=True, weights_only=True, output_loading_info=True
    )
    if loading.get("missing_keys") or loading.get("mismatched_keys"):
        raise RuntimeError("StructBERT weights did not match the classifier")
    model.eval()

    @torch.inference_mode()
    def classify(text):
        tokens = tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
        scores, ids = torch.sigmoid(model(**tokens).logits[0]).topk(2)
        return model.config.id2label[ids[0].item()], scores[0].item(), scores[1].item()

    classify("你好。")
    send({"ready": True})
    for line in sys.stdin:
        request = json.loads(line)
        try:
            label, score, second = classify(request["text"])
            send({"id": request["id"], "label": label, "score": score, "second": second})
        except Exception:
            send({"id": request["id"]})


if __name__ == "__main__":
    main()
