# Tabela Periódica Interativa

Aplicação web para explorar os 118 elementos químicos: propriedades, pesquisa, filtros e comparação lado a lado. Feita só com HTML, CSS e JavaScript puro — sem frameworks, sem servidor, sem internet.

## Como abrir

1. Copie a pasta `periodic-table` para qualquer lugar do computador.
2. Dê dois cliques em **`index.html`**. O arquivo abre no navegador padrão (Edge, Chrome ou Firefox no Windows 10/11).

Não é preciso instalar nada nem estar conectado à internet. Todos os dados estão em `elements.js`, carregado como script comum (não como módulo ES), justamente para funcionar no protocolo `file://`, onde navegadores bloqueiam `fetch()` de arquivos locais e módulos.

## Como usar

| Recurso | Como acessar |
|---|---|
| Ver resumo de um elemento | Passe o cursor (ou o foco do teclado) sobre ele; o resumo aparece na área vazia acima dos metais de transição. |
| Ver todas as propriedades | Clique no elemento: abre o painel lateral. As setas `‹ ›` do painel navegam para o elemento anterior/seguinte. |
| Pesquisar | Digite nome (português ou inglês, com ou sem acento), símbolo ou número atômico. Os resultados são destacados enquanto você digita; `Enter` abre o melhor resultado. |
| Filtrar por família | Clique nos itens da legenda (pode combinar vários). Os marcadores “57–71” e “89–103” filtram lantanídeos e actinídeos. |
| Filtrar por estado / origem | Menus “Estado físico” e “Origem”. Filtros se combinam entre si e com a pesquisa; os elementos fora do filtro ficam esmaecidos, não somem. |
| Comparar até 3 elementos | Botão “Adicionar à comparação” no painel, `Shift` + clique na tabela, ou ative o **Modo comparação** e clique nos elementos. Depois, “Comparar lado a lado”. |
| Limpar | “Limpar pesquisa e filtros” e “Limpar seleção” (fecha o painel e esvazia a comparação). |
| Tema, legenda, informações | Botões “Tema claro/escuro”, “Legenda” e “Sobre” no cabeçalho. Tema e legenda ficam salvos no navegador. |

### Teclado

- `/` foca a pesquisa; `Esc` limpa a pesquisa ou fecha painel/janela.
- Setas navegam pela tabela (uma única parada de `Tab` para a tabela inteira); `Home`/`End` vão ao H e ao Og.
- `Enter` abre os detalhes; `Shift` + `Enter` adiciona à comparação.

## Estrutura

```
periodic-table/
├── index.html    estrutura da página e diálogos
├── styles.css    temas, layout em CSS Grid, animações e responsividade
├── script.js     construção da tabela, pesquisa, filtros, painel, comparação, teclado
├── elements.js   dados dos 118 elementos (window.PERIODIC_ELEMENTS)
└── README.md
```

A tabela usa CSS Grid com 18 colunas de largura mínima de 62 px. Em telas estreitas a tabela rola horizontalmente em vez de encolher as células, preservando a legibilidade dos símbolos.

## Dados: origem e confiabilidade

| Campo | Fonte |
|---|---|
| Massa atômica | Pesos atômicos padrão abreviados da **IUPAC/CIAAW** (tabela de 2021). Para elementos sem isótopos estáveis, o valor entre colchetes é o número de massa do isótopo de vida mais longa conhecido; esse valor pode variar entre fontes conforme novas medições. |
| Densidade, fusão, ebulição | Base de dados aberta **mendeleev** (v1.3, licença MIT), que compila valores do **CRC Handbook of Chemistry and Physics**, do **NIST** e da literatura. Temperaturas em kelvin; densidades a ~25 °C (gases a 25 °C e 1 atm, em g/L). |
| Configuração eletrônica | Mesma base, com as exceções experimentais ao princípio de Aufbau (Cr, Cu, Nb, Mo, Pd, Au, Pt, Gd, Th, U etc.). |
| Nomes em português | Nomenclatura usada no Brasil (IUPAC/SBQ). |
| Descoberta, usos, curiosidades | Redação própria, conferida com referências gerais (IUPAC, Royal Society of Chemistry, literatura histórica). Datas de descoberta seguem a convenção mais citada; quando há disputa ou isolamento posterior, o texto do descobridor indica isso. |
| Estado físico, origem | Derivados dos pontos de fusão/ebulição (estado a 25 °C, 1 atm) e da ocorrência natural conhecida. |

### Como lacunas e incertezas são tratadas

- **Nenhum valor fictício.** Quando não há medição confiável, o campo é `null` e a interface mostra “Indisponível”.
- **Estimativas são marcadas.** O campo `estimated` lista as propriedades extrapoladas ou calculadas (ex.: densidade e ponto de fusão do astato e do frâncio, densidade do rádio, pontos de fusão do férmio ao laurêncio). A interface mostra o selo **ESTIMADO**.
- **Configurações teóricas são marcadas.** Do laurêncio (103) ao oganessônio (118) a configuração eletrônica é prevista por cálculo (`configPredicted: true`, selo **PREVISTO**).
- **Elementos a partir do férmio (100)** nunca foram obtidos em quantidade visível: estado físico “desconhecido” e densidade indisponível. Previsões teóricas de densidade que aparecem em algumas tabelas foram deliberadamente omitidas.
- **Casos especiais** têm observação no painel: hélio (não solidifica a 1 atm), carbono e arsênio (sublimam), fósforo (fósforo branco), enxofre, selênio e estanho (alótropo usado), actínio (valores divergentes na literatura).

### Escolhas de classificação

Algumas classificações variam entre tabelas publicadas; as adotadas aqui são:

- **Semimetais:** B, Si, Ge, As, Sb, Te. O polônio aparece como “outros metais” (há fontes que o tratam como semimetal — nota no painel).
- **Halogênios:** F, Cl, Br, I, At. **Gases nobres:** He a Rn.
- **Classificação incerta:** Mt (109) a Og (118), cuja química é praticamente desconhecida. Rf a Hs aparecem como metais de transição.
- **Série f:** La–Lu e Ac–Lr, com grupo exibido como “série f”. A posição de La/Ac e Lu/Lr no grupo 3 ainda é debatida e foi tema de um projeto da IUPAC.
- **Origem:** “primordial” = presente desde a formação da Terra (inclui Bi, Th, U); “natural apenas em traços” = Tc, Pm, Po, At, Rn, Fr, Ra, Ac, Pa, Np, Pu; “sintético” = Am (95) em diante.

### Atualização dos dados

A CIAAW revisa periodicamente os pesos atômicos padrão, e propriedades de elementos raros são remedidas. Para uso acadêmico formal, confira os valores com as fontes primárias:

- IUPAC/CIAAW — Standard Atomic Weights: https://www.ciaaw.org
- NIST — Atomic Weights and Isotopic Compositions / Periodic Table: https://www.nist.gov/pml/periodic-table-elements
- CRC Handbook of Chemistry and Physics (edição atual)
- mendeleev (base usada): https://github.com/lmmentel/mendeleev

## Compatibilidade

Testado em Chromium (motor do Chrome e do Edge) abrindo `index.html` direto do disco, sem rede: 118 elementos, posições de grupos/períodos, pesquisa, filtros, seleção, comparação, teclado, temas e layout de celular — sem erros no console e sem nenhuma requisição externa. Usa recursos suportados por Edge/Chrome 111+ e Firefox 113+ (`color-mix`, container queries, `<dialog>`).

Se o navegador bloquear o salvamento de preferências (por exemplo em janela anônima), o tema e a legenda simplesmente voltam ao padrão; o restante funciona normalmente.
