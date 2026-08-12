rule EICAR_Test_File
{
    meta:
        description = "Standard EICAR antivirus test file"
        severity = "high"
    strings:
        $eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    condition:
        $eicar
}

rule Suspicious_Embedded_PE
{
    meta:
        description = "MZ header embedded in document"
        severity = "high"
    strings:
        $mz = { 4D 5A }
    condition:
        $mz at 0 or $mz
}

rule Suspicious_Script_In_Document
{
    meta:
        description = "Common script markers in uploaded documents"
        severity = "medium"
    strings:
        $js1 = "<script" nocase
        $js2 = "javascript:" nocase
        $vbs = "CreateObject(" nocase
        $ps = "powershell" nocase
    condition:
        any of them
}
