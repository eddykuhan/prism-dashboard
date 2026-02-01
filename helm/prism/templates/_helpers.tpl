{{/*
Expand the name of the chart.
*/}}
{{- define "prism.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "prism.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "prism.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "prism.labels" -}}
helm.sh/chart: {{ include "prism.chart" . }}
{{ include "prism.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "prism.selectorLabels" -}}
app.kubernetes.io/name: {{ include "prism.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "prism.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "prism.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
DynamoDB environment variables
*/}}
{{- define "prism.dynamodbEnv" -}}
{{- if eq .Values.storage.type "dynamodb" }}
- name: DYNAMODB_SERVICE_URL
  value: {{ .Values.storage.dynamodb.endpoint | quote }}
- name: AWS_REGION
  value: {{ .Values.storage.dynamodb.region | quote }}
- name: DYNAMODB_LOGS_TABLE
  value: {{ .Values.storage.dynamodb.logsTable | quote }}
- name: DYNAMODB_METRICS_TABLE
  value: {{ .Values.storage.dynamodb.metricsTable | quote }}
- name: DYNAMODB_TRACES_TABLE
  value: {{ .Values.storage.dynamodb.tracesTable | quote }}
- name: DYNAMODB_TTL_DAYS
  value: {{ .Values.storage.dynamodb.ttlDays | quote }}
{{- end }}
{{- end }}
