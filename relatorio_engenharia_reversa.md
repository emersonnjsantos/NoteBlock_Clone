# Relatório de Engenharia Reversa: Windows Notepad (`notepad.exe`)

**Data da Análise:** Outubro de 2026  
**Alvo:** `C:\Windows\System32\notepad.exe`  
**Ferramentas Utilizadas:** REA (Reverse Engineer Anything), REA PE Resource Parser, Scripts de Extração Estática de PE/MUI.

---

## 1. Identidade do Binário (Visto / Observado)

- **Caminho do Binário:** `C:\Windows\System32\notepad.exe`
- **SHA-256:** `468ffe129c395abf6b21a09efdf261910a95fb98aa982ead73caa7b2b684577e`
- **Formato:** PE32+ (Executável nativo x86-64 do Windows)
- **Tamanho:** 360.448 bytes (352 KB)
- **Seções Identificadas:**
  - `.text` (RVA `0x1000`, Raw `0x1000`): Código executável principal
  - `fothk` (RVA `0x28000`, Raw `0x28000`): Thunks
  - `.rdata` (RVA `0x29000`, Raw `0x29000`): Dados somente leitura (tabelas de importação, constantes)
  - `.data` (RVA `0x34000`, Raw `0x34000`): Variáveis globais mutáveis
  - `.pdata` (RVA `0x37000`, Raw `0x35000`): Informações de desenrolamento de exceções (x64 SEH)
  - `.didat` (RVA `0x39000`, Raw `0x37000`): Delay-load import descriptors
  - `.rsrc` (RVA `0x3a000`, Raw `0x38000`): Recursos (ícones, manifestos, referências MUI)
  - `.reloc` (RVA `0x59000`, Raw `0x57000`): Tabela de realocações de base

---

## 2. Recursos Extraídos do Binário e MUI (Visto / Observado)

O Windows desacopla recursos de idioma no formato MUI (Multilingual User Interface). Foram analisados `C:\Windows\System32\pt-BR\notepad.exe.mui` (SHA256: `291399859984c17d1c4396cad8c1a1428dc1e3eaa46a93a48e4c0581d8dcca95`) e `en-US\notepad.exe.mui`:

### Menus e Aceleradores Extraídos
1. **Arquivo (File):**
   - Novo (`Ctrl+N`)
   - Nova Janela (`Ctrl+Shift+N`)
   - Abrir... (`Ctrl+O`)
   - Salvar (`Ctrl+S`)
   - Salvar Como... (`Ctrl+Shift+S`)
   - Configurar Página...
   - Imprimir... (`Ctrl+P`)
   - Sair (`Alt+F4`)
2. **Editar (Edit):**
   - Desfazer (`Ctrl+Z`)
   - Recortar (`Ctrl+X`)
   - Copiar (`Ctrl+C`)
   - Colar (`Ctrl+V`)
   - Excluir (`Del`)
   - Buscar com o Bing... (`Ctrl+E`)
   - Localizar... (`Ctrl+F`)
   - Localizar próxima (`F3`)
   - Localizar anterior (`Shift+F3`)
   - Substituir... (`Ctrl+H`)
   - Ir para... (`Ctrl+G`)
   - Selecionar tudo (`Ctrl+A`)
   - Hora/data (`F5`)
3. **Formatar (Format):**
   - Quebra automática de linha (Word Wrap) — Alternância com marcação (Checkmark)
   - Fonte... — Diálogo de seleção de Família, Estilo (Normal, Negrito, Itálico), Tamanho e Amostra
4. **Exibir (View):**
   - Zoom:
     - Ampliar (`Ctrl + +`)
     - Reduzir (`Ctrl + -`)
     - Restaurar Zoom Padrão (`Ctrl+0`)
   - Barra de status — Alternância com marcação
5. **Ajuda (Help):**
   - Exibir Ajuda
   - Enviar Comentários
   - Sobre o Bloco de notas

### Ícones Oficiais Extraídos
- Extraído com fidelidade total de `RT_GROUP_ICON` do binário para `d:\CLONE_MODELO\notepad_icon.png` (resolução máxima de 256x256 com canal alfa) e `notepad_icon.ico` com 13 tamanhos embutidos.

---

## 3. Arquitetura do Sistema e Hooks da Janela

### O Que Foi Observado (Visto via Imports e Recursos):
- **Janela e Loop de Mensagens:**
  - Uso de `CreateWindowExW`, `DefWindowProcW`, `GetMessageW`, `TranslateMessage`, `DispatchMessageW`.
  - Tratamento de menus via `WM_COMMAND`, `GetMenu`, `CheckMenuItem`, `EnableMenuItem`.
  - Caixa de status criada com `CreateStatusWindowW` da biblioteca `COMCTL32.dll`.
- **Renderização e Tipografia:**
  - Importação de `CreateFontIndirectW`, `GetTextMetricsW`, `TextOutW`, `EnumFontsW`.
  - Fonte padrão padrão no Windows moderno: `Consolas` / `Lucida Console`, tamanho padrão 11pt, regular.
- **I/O e Codificação de Caracteres:**
  - Funções de I/O de arquivo: `CreateFileW`, `ReadFile`, `WriteFile`.
  - Detecção de encoding: chamada para `IsTextUnicode` (detecta BOMs UTF-8 `EF BB BF`, UTF-16 LE `FF FE`, UTF-16 BE `FE FF`, ou ANSI).
  - Suporte a terminação de linha `Windows (CRLF)` e `UNIX (LF)`.

### O Que Foi Inferido (Inferência Arquitetural Padrão Win32):
- **Controle de Edição:** O Bloco de Notas tradicional gerencia o buffer de texto através de uma janela filha de classe padrão `"EDIT"` com estilos `WS_CHILD | WS_VISIBLE | WS_VSCROLL | ES_MULTILINE | ES_NOHIDESEL`.
- **Comportamento de Quebra Automática de Linha (Word Wrap):** No controle Win32 `EDIT`, o estilo `ES_AUTOHSCROLL` e `WS_HSCROLL` não podem ser alterados em tempo de execução via `SetWindowLongPtr`. Para alternar "Quebra de Linha", o Notepad salva o conteúdo, o cursor e a seleção, destrói a janela de edição antiga e recria uma nova janela de edição com ou sem `ES_AUTOHSCROLL`. Quando a Quebra Automática está ativa, a barra de rolagem horizontal é ocultada e a linha atual quebra dinamicamente.
- **Barra de Status:** Dividida em 4 partes:
  1. Posição do cursor: `Lin {linha}, Col {coluna}`
  2. Nível de Zoom: `{zoom}%`
  3. Fim de linha: `Windows (CRLF)`
  4. Codificação: `UTF-8`
- **Ciclo de Vida do Arquivo e Diálogo de Confirmação:** Se o buffer foi alterado (`modified == true`), ao fechar, criar novo arquivo ou abrir outro, o Notepad intercepta com a caixa de diálogo modal `"Deseja salvar as alterações em {NomeDoArquivo}?"` com opções `[Salvar]`, `[Não Salvar]` e `[Cancelar]`.
- **Inserção de Data e Hora (F5):** Formata a hora e data atual do sistema no padrão local (ex: `12:45 14/10/2026`) e insere diretamente no ponto de inserção do cursor.

---

## 4. Plano de Implementação da Aplicação Web/Desktop

A aplicação será construída como um aplicativo moderno, de altíssima fidelidade, responsivo, rico e limpo dentro de `D:\CLONE_MODELO`:
- **Interface e Estilo:** Design System fiel ao Windows 10/11 Notepad, com temas Claro e Escuro (Fluent/Modern Windows UI), menus suspensos autênticos com atalhos de teclado reais, caixas de diálogo modais fiéis (Localizar, Substituir, Ir Para Linha, Fonte, Configurar Página, Sobre o Bloco de Notas, Confirmação de Saída).
- **Recursos Principais:**
  - Sistema de abas / janelas limpo
  - Renderização de texto com seleção de fontes e tamanhos
  - Quebra automática de linha com alternância instantânea
  - Barra de status dinâmica em tempo real (Linha, Coluna, Caracteres, Zoom %, CRLF, UTF-8)
  - Zoom de texto dinâmico (Ctrl + +, Ctrl + -, Ctrl + 0, ou Ctrl + Rodinha do mouse)
  - Operações de arquivo reais (Abrir arquivo local, Salvar, Salvar Como, Exportar TXT/MD/JS/HTML)
  - Diálogos completos de busca e substituição com suporte a maiúsculas/minúsculas e ciclo (wrap around)
  - Totalmente utilizável tanto em navegador (Web) quanto localmente.
