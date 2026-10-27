# DNA do Futebol — Documentação de Acesso Administrativo

A rota e a API de leads foram totalmente protegidas com autenticação por token criptografado (HMAC-SHA256) e cookies restritos (`HttpOnly`, `SameSite=Strict`).

## 1. URL de Acesso ao Painel de Leads
- **URL**: [http://localhost:8080/leads.html](http://localhost:8080/leads.html)
- O link não está visível publicamente no rodapé da página nem na navegação.

## 2. Credenciais de Login
- **Usuário**: `paulovitor`
- **Senha**: `DnaFutebol@2026`

*(Observação: as credenciais podem ser customizadas no arquivo `server.js` ou via variáveis de ambiente `ADMIN_USER` e `ADMIN_PASS`).*

---

## 3. Funcionalidades da Área de Gestão
1. **Painel de Métricas (KPIs)**:
   - Total de jogadores cadastrados no banco Neon PostgreSQL.
   - Leads aguardando contato vs. já contatados.
   - Maior recorde registrado na Arena.
2. **Ação Direta no WhatsApp**:
   - Botão *"Chamar no WhatsApp"* que abre a conversa já com mensagem pré-formatada citando o nome do atleta, sua pontuação e o modo disputado.
   - Ao clicar, o lead é marcado como **Contatado** automaticamente.
3. **Filtros e Busca**:
   - Filtro rápido por *Todos*, *Pendentes* e *Contatados*.
   - Busca em tempo real por nome, telefone ou modo de jogo.
4. **Exportação de Dados**:
   - Botão *"Exportar CSV"* para download da lista de contatos para planilhas ou importação em ferramentas de CRM.
