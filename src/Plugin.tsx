import React from 'react';
import { useState, useEffect } from 'react'
import { Button, Input, Radio } from '@dhis2/ui';
import { IFormFieldPluginProps } from './Plugin.types';
import { convertToFHIRBundle, extractPersonFromFHIR } from './utils/fhirUtils';

const Plugin = ({
    values,
    fieldsMetadata,
    setFieldValue
}: IFormFieldPluginProps) => {

    // Identifier systems
    interface Identifier {
        "label": string
        "system": string
        "baseUrl": string
        "routeId": string
        "authHeader": string
        "contentType": string
        "queryString": string
        "successAction": string
    }

    // Datastore config
    interface Config {
        identifiers: Record<string, Identifier>
        healthIdSystemKey:string
    }

    const [config, setConfig] = useState<Config | null>(null)
    const [basePath, setBasePath] = useState<string>('')
    const [enteredId, setEnteredId] = useState("");
    const [idType, setIdType] = useState<string>('')
    const [message, setMessage] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const [actionLink, setActionLink] = useState<React.ReactNode>(null)
    
    useEffect(() => {
        const pathname = window.location.pathname
        let base = '/' + pathname.split('/').filter(Boolean)[0]
        if (base === '/api') base = ''
        
        setBasePath(base)

        const fetchConfig = async () => {
            try {
                setLoading(true)
                const response = await fetch(`${base}/api/dataStore/healthidconnect/config`)
                const data = await response.json()

                setConfig(data)

                const healthidKey = data.healthIdSystemKey || null

                if (!healthidKey) {
                    setError('Health ID system is not configured...')
                }
            } catch (err) {
                setError('Failed to fetch config...')
            } finally {
                setLoading(false)
            }
        }

        fetchConfig()
    }, [])



    const fetchExternalData = async () => {
        var response:Record<string, any> = {}
        const routeId = config.identifiers[idType].routeId || null
        const queryString = config.identifiers[idType].queryString || null
        const idSystem = config.identifiers[idType].system || null
        const baseUrl = config.identifiers[idType].baseUrl || null

        if(config.identifiers[idType].routeId){
            // DHIS2 routes api - priority 1
            const fetchUrl = `${basePath}/api/routes/${routeId}/run?${queryString}`
                .replaceAll("{system}", idSystem)
                .replaceAll("{id}", enteredId)
            response = await fetch(fetchUrl)
        }else if(config.identifiers[idType].baseUrl){
            // baseUrl from config - priority 2
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': config.identifiers[idType].authHeader
            }
            const fetchUrl = `${baseUrl}?${queryString}`
                .replaceAll("{system}", idSystem)
                .replaceAll("{id}", enteredId)
            response = await fetch(fetchUrl, { headers })
        }else{
            setMessage("Either routesId or fhirBaseUrl should exist.")
        }
        
        const data = await response.json()    
        return data
    }

    const populateAttributeFields = async (person: Record<string, any>) => {
                
        if(!person){
            setMessage("No match found")
            clearFields()
        }else{
            setMessage("Match found, data loaded...")
            const healthIdSystemFromConfig = config.identifiers[config.healthIdSystemKey].system
            setFieldValue({
                fieldId: 'healthId',
                value: person.identifiers[healthIdSystemFromConfig]
            });

            setFieldValue({
                fieldId: 'firstName',
                value: person.firstName.split(" ")[0]
            });

            setFieldValue({
                fieldId: 'middleName',
                value: person.firstName.split(" ")[1]
            });

            setFieldValue({
                fieldId: 'lastName',
                value: person.lastName
            });

            setFieldValue({
                fieldId: 'birthDate',
                value: {date: person.birthDate}
            });

            setFieldValue({
                fieldId: 'gender',
                value: person.gender
            });

            setFieldValue({
                fieldId: 'address',
                value: person.address
            });

            setFieldValue({
                fieldId: 'phone',
                value: person.phone
            });

            setFieldValue({
                fieldId: 'email',
                value: person.email
            });
        }

        setTimeout(() => {
            setMessage('')
        }, 5000)
    };

    const initialize = async () => {
        setActionLink(null)
        setMessage('')

        if (!idType) {
            setMessage('Please select ID type.')
            return
        }

        if (!enteredId) {
            setMessage('Please enter a valid ID number of selected type.')
            return
        }

        const rawData = await fetchExternalData()

        var bundle: any

        if (rawData.resourceType === 'Bundle') {
            bundle = rawData
        } else {
            // Non-FHIR — convert first
            let selectedConfig:Record<any,any> = config.identifiers[idType]
            let fhirMap = selectedConfig['fhirMap'] || null
            const identifierSystem = selectedConfig.system || null

            bundle = convertToFHIRBundle(
                rawData,
                fhirMap,
                identifierSystem
            )
        }
        if (!bundle) {
            setMessage('No match found.')
            clearFields()
            return
        }
        const person = extractPersonFromFHIR(bundle)

        if (!person){
            setMessage('No match found')
            clearFields()
            return
        }

        const successAction = config.identifiers[idType].successAction || null
        const [actionName, actionArgs] = successAction ? successAction.split(':') : [null, null]

        if (!actionName) {
            setMessage('No action configured.')
            return
        }

        switch (actionName?.toLowerCase()) {
            case 'populateattributedata':
                await populateAttributeFields(person)
                break
            case 'showlink':
                const linkUrl = actionArgs || ''
                if (linkUrl) {
                    //https://ocl.hmis.gov.np/ephc/api/42/tracker/trackedEntities?filter=q3NpuWzGvso:eq:26051500021&orgUnits=wlCRZPmSBIP&orgUnitMode=SELECTED&program=kvottqqHM1j&fields=enrollments[enrollment,orgUnit,trackedEntity,program,attributes]
                    setActionLink(
                        <a href={linkUrl} target="_blank" rel="noreferrer"
                        style={{ color: '#1a6bb5', fontWeight: 600, fontSize: '13px' }}>
                            🔗 View Dashboard
                        </a>
                    )
                }
                break
            default:
                setMessage('Unknown success action: ' + actionName)
        }
    }

    const clearFields = () => {
        setFieldValue({ fieldId: "firstName", value: "" });
        setFieldValue({ fieldId: "middleName", value: "" });
        setFieldValue({ fieldId: "lastName", value: "" });
        setFieldValue({ fieldId: "birthDate", value: "" });
        setFieldValue({ fieldId: "gender", value: "" });
        setFieldValue({ fieldId: "address", value: "" });
        setFieldValue({ fieldId: "phone", value: "" });
        setFieldValue({ fieldId: "email", value: "" });
    };

    if (loading) return <span style={{color:'#ccc', margin:'15px'}}>Loading...</span>
    if (error) return <span style={{color:'red', margin:'15px'}}>{error}</span>

    return (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', padding:'15px',border:'2px solid #c5ec9e',background:'#efe',margin:'0 5px',borderRadius:'10px'  }}>
            <div style={{ display:'flex', flexDirection:'row', gap:'8px' }}>
                Search for health ID with available ID numbers below.
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '16px' }}>
                {config && Object.entries(config.identifiers).map(([key, identifier]) => (
                    <React.Fragment key={key}>
                        <Radio label={identifier.label} value={key} name={key} checked={idType === key}
                            onChange={({ value }) => setIdType(value)}
                        />
                    </React.Fragment>
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                    <Input type="text" placeholder="Enter ID" value={enteredId}
                        onChange={({ value }) => setEnteredId(value)}
                    />
                    <Button onClick={initialize}> खोज्नुहोस </Button>
            </div>

            {message && (
                <div style={{ display:'flex', flexDirection:'row', gap:'8px' }}>
                    {message}
                </div>
            )}

            {actionLink && (
                <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                    {actionLink}
                </div>
            )}
        </div>
    )
}

export default Plugin