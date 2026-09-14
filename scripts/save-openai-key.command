#!/bin/zsh
set -eu

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h}"
SECRET_DIR="${PROJECT_DIR}/work/secrets"
SECRET_FILE="${SECRET_DIR}/openai-api-key.txt"

umask 077
mkdir -p "${SECRET_DIR}"
chmod 700 "${SECRET_DIR}"

echo "请粘贴在 OpenAI API Platform 创建的项目 API Key。"
echo "输入内容不会显示；按回车保存。"
read -rs "OPENAI_PROJECT_KEY?API Key: "
echo

case "${OPENAI_PROJECT_KEY}" in
  sk-*) ;;
  *)
    echo "没有保存：密钥格式应以 sk- 开头。"
    read -k 1 "?按任意键关闭…"
    exit 1
    ;;
esac

printf '%s\n' "${OPENAI_PROJECT_KEY}" > "${SECRET_FILE}"
chmod 600 "${SECRET_FILE}"
unset OPENAI_PROJECT_KEY

echo "密钥已安全保存到本机项目的 work/secrets 目录。"
echo "现在回到 Codex，告诉我：密钥已保存。"
read -k 1 "?按任意键关闭…"
