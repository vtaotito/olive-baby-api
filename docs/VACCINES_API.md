# API de Vacinas - Olive Baby

## Visão Geral

A funcionalidade de Vacinas permite aos usuários Premium acompanhar o calendário de vacinação de seus bebês, baseado no Programa Nacional de Imunização (PNI) do Brasil.

## Requisitos

- **Autenticação**: Todas as rotas requerem token JWT válido
- **Plano Premium**: Todas as rotas de vacinas do bebê requerem plano Premium (exceto listagem de calendários)

## Endpoints

### Públicos (apenas autenticação)

#### GET /api/v1/vaccines/calendars
Lista calendários de vacinas disponíveis.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "code": "PNI",
      "name": "Programa Nacional de Imunização (PNI)",
      "description": "Calendário oficial do Ministério da Saúde do Brasil",
      "isDefault": true
    }
  ]
}
```

#### GET /api/v1/vaccines/definitions
Lista todas as definições de vacinas do calendário.

**Query Params:**
- `source` (opcional): `PNI` ou `SBIM` (default: `PNI`)

### Premium (requer plano Premium)

#### GET /api/v1/babies/:babyId/vaccines/summary
Retorna resumo das vacinas do bebê com contadores e próximas vacinas.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 35,
    "applied": 5,
    "pending": 25,
    "overdue": 3,
    "skipped": 2,
    "nextVaccines": [
      {
        "id": 1,
        "vaccineName": "Pentavalente",
        "doseLabel": "1ª dose",
        "recommendedAt": "2026-03-15",
        "daysUntil": 5,
        "isOverdue": false
      }
    ]
  },
  "disclaimer": "O calendário pode variar por indicação médica..."
}
```

#### GET /api/v1/babies/:babyId/vaccines/timeline
Lista todas as vacinas do bebê em formato timeline.

**Query Params:**
- `status` (opcional): `PENDING`, `APPLIED`, `SKIPPED`
- `source` (opcional): `PNI`, `SBIM`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "vaccineKey": "BCG",
      "vaccineName": "BCG",
      "doseLabel": "dose única",
      "doseNumber": 1,
      "recommendedAt": "2026-01-10",
      "appliedAt": "2026-01-10",
      "status": "APPLIED",
      "source": "PNI",
      "lotNumber": "12345ABC",
      "clinicName": "Hospital XYZ",
      "professionalName": "Dr. João",
      "notes": null,
      "isOverdue": false,
      "daysUntil": -5
    }
  ]
}
```

#### POST /api/v1/babies/:babyId/vaccines/sync
Sincroniza vacinas do calendário para o bebê (idempotente).

**Request Body:**
```json
{
  "source": "PNI"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sincronização concluída: 35 vacinas adicionadas",
  "data": {
    "synced": 35,
    "existing": 0,
    "total": 35
  }
}
```

#### POST /api/v1/babies/:babyId/vaccines/record
Cria um registro manual de vacina.

**Request Body:**
```json
{
  "vaccineKey": "CUSTOM",
  "vaccineName": "Vacina Personalizada",
  "doseLabel": "1ª dose",
  "doseNumber": 1,
  "recommendedAt": "2026-03-15",
  "appliedAt": "2026-03-15",
  "source": "PNI",
  "lotNumber": "ABC123",
  "clinicName": "UBS Centro",
  "professionalName": "Enf. Maria",
  "notes": "Observação"
}
```

#### GET /api/v1/babies/:babyId/vaccines/record/:id
Retorna detalhes de um registro específico.

#### PATCH /api/v1/babies/:babyId/vaccines/record/:id
Atualiza um registro de vacina.

**Request Body:**
```json
{
  "appliedAt": "2026-03-15",
  "status": "APPLIED",
  "lotNumber": "ABC123",
  "clinicName": "UBS Centro",
  "professionalName": "Enf. Maria",
  "notes": "Observação"
}
```

#### POST /api/v1/babies/:babyId/vaccines/record/:id/apply
Marca vacina como aplicada.

**Request Body:**
```json
{
  "appliedAt": "2026-03-15",
  "lotNumber": "ABC123",
  "clinicName": "UBS Centro",
  "professionalName": "Enf. Maria",
  "notes": "Observação"
}
```

#### POST /api/v1/babies/:babyId/vaccines/record/:id/skip
Marca vacina como pulada.

**Request Body:**
```json
{
  "notes": "Motivo para pular a vacina"
}
```

#### POST /api/v1/babies/:babyId/vaccines/record/:id/reset
Reseta vacina para pendente.

#### DELETE /api/v1/babies/:babyId/vaccines/record/:id
Remove um registro de vacina.

## Status de Vacina

- `PENDING`: Vacina pendente (pode estar no prazo ou atrasada)
- `APPLIED`: Vacina já aplicada
- `SKIPPED`: Vacina foi pulada/não será aplicada

## Regras de Negócio

1. **Sincronização Idempotente**: O endpoint `/sync` não cria duplicatas
2. **Data de Aplicação**: Não pode ser no futuro
3. **Vacina Atrasada**: Quando `recommendedAt < hoje` e `status = PENDING`
4. **Cálculo de Datas**: Baseado no `birthDate` do bebê + `ageMonths` da definição

## Seed do Calendário PNI

Execute o seed para popular as definições de vacinas:

```bash
npm run seed:vaccines
```

## Disclaimer

> "O calendário pode variar por indicação médica e condições especiais. Confirme com seu pediatra/UBS."

Este aviso é retornado em todas as respostas da API de vacinas.
