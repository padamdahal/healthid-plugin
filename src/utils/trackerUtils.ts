
export interface EnrollmentDetails {
    enrollmentId: string
    programId: string
    orgUnitId: string
    teiId: string
}

export const fetchEnrollmentBySystemId = async (
    basePath: string,
    systemId: string
): Promise<EnrollmentDetails | null> => {

    const url = `${basePath}/api/tracker/trackedEntities
        ?filter=q3NpuWzGvso:eq:${systemId}
        &orgUnitMode=ACCESSIBLE
        &program=kvottqqHM1j
        &fields=enrollments[enrollment,orgUnit,trackedEntity,program,attributes]`

    try {
        const response = await fetch(url)

        if (!response.ok) {
            console.warn('dhisUtils: fetch failed', response.status, response.statusText)
            return null
        }

        const data = await response.json()

        // Check empty
        if (
            !data.trackedEntities ||
            data.trackedEntities.length === 0
        ) {
            console.warn('dhisUtils: no tracked entity found for systemId', systemId)
            return null
        }

        const tei         = data.trackedEntities[0]
        const enrollments = tei.enrollments || []

        if (enrollments.length === 0) {
            console.warn('dhisUtils: no enrollments found for tei', tei.trackedEntity)
            return null
        }

        // Get enrollment matching config programId if available, else first
        const enrollment = config.programId
            ? enrollments.find((e: any) => e.program === config.programId) || enrollments[0]
            : enrollments[0]

        return {
            enrollmentId: enrollment.enrollment  || '',
            programId:    enrollment.program     || '',
            orgUnitId:    enrollment.orgUnit     || '',
            teiId:        tei.trackedEntity      || ''
        }

    } catch (err) {
        console.error('dhisUtils: error fetching enrollment', err)
        return null
    }
}