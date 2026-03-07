---
name: commitar
description: Commita e faz push de todas as alteracoes para o GitHub. Use ao final de cada iteracao de trabalho para salvar o progresso. Aceita argumento opcional com mensagem de commit.
argument-hint: "[mensagem-de-commit-opcional]"
---

# Commitar - Salvar Progresso no GitHub

Faca commit e push de todas as alteracoes atuais para o repositorio GitHub.

## Passos

1. Execute `git status` para ver todas as alteracoes (staged, unstaged, untracked)
2. Execute `git diff` para entender o que mudou
3. Execute `git log --oneline -3` para ver o estilo dos commits recentes

4. Se nao houver alteracoes, informe ao usuario que nao ha nada para commitar e pare.

5. Analise as alteracoes e determine uma mensagem de commit:
   - Se o usuario forneceu mensagem em `$ARGUMENTS`, use-a como base
   - Se nao, crie uma mensagem descritiva em portugues baseada nas alteracoes
   - Formato: uma linha resumo + linha vazia + detalhes se necessario
   - Mensagem em portugues brasileiro

6. Adicione os arquivos alterados ao staging:
   - Use `git add` com nomes especificos de arquivos (NAO use `git add -A`)
   - NAO adicione arquivos sensiveis (.env, credentials, tokens, settings.local.json)
   - Respeite o .gitignore

7. Crie o commit usando HEREDOC:
```bash
git commit -m "$(cat <<'EOF'
Mensagem de commit aqui

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

8. Faca push para o remote:
```bash
git push origin main
```

9. Confirme o sucesso com `git log --oneline -1` e informe ao usuario.

## Regras
- NUNCA use `git add -A` ou `git add .` - sempre especifique arquivos
- NUNCA adicione .env, credentials, tokens ou settings.local.json
- NUNCA use --force ou --no-verify
- Se o push falhar, informe o erro ao usuario sem tentar force push
- Mensagens de commit devem ser em portugues
