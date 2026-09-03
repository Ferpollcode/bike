# Costos de infraestructura — BIKE STORE MDZ

Resumen para calcular cuánto cobrar por mantener este proyecto corriendo. El objetivo es cubrir costos, no generar ganancia.

## Stack usado

- **Hosting / build**: Vercel (Next.js)
- **Base de datos**: Supabase (Postgres)
- **Dominio**: ninguno propio. Se usa el subdominio gratuito `bikestoremdz.vercel.app`
- **Sin otras integraciones de pago** (no hay APIs externas, envío de WhatsApp se hace vía el share nativo del navegador, sin costo)

## Costos actuales (plan gratuito)

| Servicio | Plan | Costo mensual |
|---|---|---|
| Vercel | Hobby | $0 |
| Supabase | Free | $0 |
| Dominio | subdominio `.vercel.app` | $0 |
| **Total actual** | | **$0/mes** |

Para el volumen de uso de este proyecto (un solo comercio, pocos usuarios concurrentes, una tabla de estado en Supabase), los planes gratuitos alcanzan sin problema. No hay costo real hoy.

## Límites del plan gratuito (cuándo dejaría de ser gratis)

**Vercel Hobby:**
- 100 GB de transferencia/mes, builds limitados, solo uso no comercial estricto (uso personal/proyectos chicos).
- Si se necesita uso comercial formal o más tráfico → **Vercel Pro: USD 20/mes** (por miembro).

**Supabase Free:**
- 500 MB de base de datos, 5 GB de transferencia/mes, el proyecto se pausa tras 1 semana de inactividad (se reactiva solo al volver a usarlo).
- Si crece la base de datos o se necesita que nunca se pause → **Supabase Pro: USD 25/mes**.

**Dominio propio (opcional):**
- Si en el futuro quiere un dominio propio (ej. `bikestoremdz.com.ar`) en vez de `.vercel.app`: aprox. **USD 10–20/año** según el registrador.

## Escenarios de costo

| Escenario | Costo mensual |
|---|---|
| Todo en plan gratuito (situación actual) | $0 |
| Vercel Pro + Supabase Free | USD 20/mes |
| Vercel Hobby + Supabase Pro | USD 25/mes |
| Vercel Pro + Supabase Pro | USD 45/mes |
| + dominio propio | + ~USD 1–2/mes prorrateado |

## Recomendación para cobrar

Mientras el uso se mantenga chico (un solo negocio, consultas esporádicas), **el costo real de infraestructura es $0**. No hay necesidad de upgrade salvo que Supabase empiece a pausarse muy seguido por inactividad o se acerque al límite de 500 MB.

Si se quiere cobrar igual un monto simbólico para tener margen ante un eventual upgrade a planes pagos, una referencia razonable sería cubrir el escenario más probable de upgrade (Supabase Pro, USD 25/mes ≈ ARS según cotización del día) más algo de tiempo de mantenimiento — no por el costo de servidores, que hoy es nulo.
