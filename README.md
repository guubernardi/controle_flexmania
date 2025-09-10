📦 Flex Controle – Sistema de Gerenciamento de Coletas

O Flex Controle é um sistema web desenvolvido para auxiliar no gerenciamento de coletas e entregas em operações logísticas, como marketplaces e transportadoras. Ele foi pensado para trazer praticidade, organização e automação no acompanhamento de pedidos, pagamentos e cancelamentos.

🚀 Funcionalidades principais

Cadastro de pedidos com informações como data, loja, nota fiscal, valor do produto, estornos e observações.

Controle de status: A Coletar, Coletado e Cancelado, com regras de cálculo automáticas.

Cálculo automático de valores a pagar considerando frete, estorno de mercadoria e frete devolvido.

Marcação de pagamentos individuais ou em massa.

Edição rápida de observações com botão de lápis (inline editing).

Filtros inteligentes por período, loja e status.

Busca instantânea por ID do pedido ou número da nota.

Exportação de dados em CSV para relatórios externos.

Resumo automático do período (total de registros, coletados, pendentes e valor total).

Fechamento automático: pedidos não entregues no dia são marcados como cancelados com desconto aplicado.

Geração de relatório para ChatGPT com prompt pronto para transformar os dados em um template de relatório.

🛠️ Tecnologias utilizadas

HTML5, CSS3 e JavaScript puro (sem dependências externas).

Estrutura responsiva e estilização clean, focada em usabilidade.

Notificações visuais para feedback em tempo real.

📊 Exemplo de uso

O operador registra os pedidos do dia.

Conforme as entregas são feitas, marca como Coletado (o sistema já adiciona o frete automaticamente).

Caso um pedido não seja entregue, pode ser marcado como Cancelado, descontando produto + frete.

No final do período, basta clicar em Gerar Relatório para enviar os dados tratados ao ChatGPT e receber um relatório pronto para apresentação.

🎯 Objetivo

Esse projeto nasceu para resolver problemas práticos de controle logístico, automatizando cálculos e centralizando informações que antes ficavam em planilhas manuais.
