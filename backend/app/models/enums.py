"""Valores estables de la API. Las etiquetas en español viven en la interfaz."""

from enum import StrEnum


class Criticality(StrEnum):
    ALTA = "alta"
    MEDIA = "media"
    BAJA = "baja"


class MachineAdminStatus(StrEnum):
    """Estado administrativo guardado. `en_averia` se deriva de las averías con parada."""

    OPERATIVA = "operativa"
    FUERA_DE_SERVICIO = "fuera_de_servicio"
    DE_BAJA = "de_baja"


class MachineStatus(StrEnum):
    """Estado efectivo expuesto por la API."""

    OPERATIVA = "operativa"
    EN_AVERIA = "en_averia"
    FUERA_DE_SERVICIO = "fuera_de_servicio"
    DE_BAJA = "de_baja"


class Role(StrEnum):
    TECNICO = "tecnico"
    OPERARIO = "operario"
    RESPONSABLE = "responsable"


class Specialty(StrEnum):
    MECANICA = "mecanica"
    ELECTRICA = "electrica"
    ELECTRONICA = "electronica"
    HIDRAULICA = "hidraulica"
    NEUMATICA = "neumatica"


class FailureType(StrEnum):
    MECANICO = "mecanico"
    ELECTRICO = "electrico"
    ELECTRONICO = "electronico"
    HIDRAULICO = "hidraulico"
    NEUMATICO = "neumatico"
    SOFTWARE = "software"
    OTRO = "otro"


class Priority(StrEnum):
    URGENTE = "urgente"
    ALTA = "alta"
    MEDIA = "media"
    BAJA = "baja"


class IncidentStatus(StrEnum):
    ABIERTA = "abierta"
    ASIGNADA = "asignada"
    EN_CURSO = "en_curso"
    RESUELTA = "resuelta"
    CERRADA = "cerrada"


class SolutionType(StrEnum):
    DEFINITIVA = "definitiva"
    PROVISIONAL = "provisional"
    SUSTITUCION = "sustitucion"
    AJUSTE = "ajuste"
