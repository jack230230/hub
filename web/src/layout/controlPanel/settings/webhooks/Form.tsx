import classnames from 'classnames';
import isNull from 'lodash/isNull';
import isUndefined from 'lodash/isUndefined';
import React, { useContext, useRef, useState } from 'react';
import { IoIosArrowBack } from 'react-icons/io';

import { API } from '../../../../api';
import { AppCtx } from '../../../../context/AppCtx';
import { EventKind, Package, PayloadKind, RefInputField, Webhook } from '../../../../types';
import { PAYLOAD_KINDS_LIST, PayloadKindsItem, SubscriptionItem, SUBSCRIPTIONS_LIST } from '../../../../utils/data';
import AutoresizeTextarea from '../../../common/AutoresizeTextarea';
import CheckBox from '../../../common/Checkbox';
import ExternalLink from '../../../common/ExternalLink';
import Image from '../../../common/Image';
import InputField from '../../../common/InputField';
import PackageIcon from '../../../common/PackageIcon';
import SearchTypeahead from '../../../common/SearchTypeahead';
import styles from './Form.module.css';

interface Props {
  webhook?: Webhook;
  onSuccess: () => void;
  onClose: () => void;
  onAuthError: () => void;
}

interface FormValidation {
  isValid: boolean;
  webhook: Webhook | null;
}

const DEAFULT_PAYLOAD_KIND: PayloadKind = PayloadKind.default;

export const DEFAULT_PAYLOAD_TEMPLATE = `{
    "specversion" : "1.0",
    "id" : "{{ .Event.id }}",
    "source" : "https://artifacthub.io/cloudevents",
    "type" : "io.artifacthub.{{ .Event.kind }}",
    "datacontenttype" : "application/json",
    "data" : {
        "package": {
            "kind": {{ .Package.kind }},
            "name": "{{ .Package.name }}",
            "version": "{{ .Package.version }}",
            "publisher": "{{ .Package.publisher }}",
            "url": "{{ .Package.url }}"
        }
    }
}`;

const WebhookForm = (props: Props) => {
  const { ctx } = useContext(AppCtx);
  const form = useRef<HTMLFormElement>(null);
  const contentTypeInput = useRef<RefInputField>(null);
  const errorWrapper = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedPackages, setSelectedPackages] = useState<Package[]>(
    !isUndefined(props.webhook) ? props.webhook.packages : []
  );
  const [eventKinds, setEventKinds] = useState<EventKind[]>(
    !isUndefined(props.webhook) ? props.webhook.eventKinds : [EventKind.NewPackageRelease]
  );
  const [isActive, setIsActive] = useState<boolean>(!isUndefined(props.webhook) ? props.webhook.active : true);
  const [contentType, setContentType] = useState<string>(
    !isUndefined(props.webhook) && props.webhook.contentType ? props.webhook.contentType : ''
  );
  const [template, setTemplate] = useState<string>(
    !isUndefined(props.webhook) && props.webhook.template ? props.webhook.template : DEFAULT_PAYLOAD_TEMPLATE
  );

  const getPayloadKind = (): PayloadKind => {
    let payloadKind: PayloadKind = DEAFULT_PAYLOAD_KIND;
    if (!isUndefined(props.webhook) && !isNull(props.webhook.contentType) && !isNull(props.webhook.template)) {
      payloadKind = PayloadKind.custom;
    }
    return payloadKind;
  };

  const [payloadKind, setPayloadKind] = useState<PayloadKind>(getPayloadKind());

  const onCloseForm = () => {
    props.onClose();
  };

  const onContentTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContentType(e.target.value);
  };

  async function handleWebhook(webhook: Webhook) {
    try {
      setIsSending(true);
      if (isUndefined(props.webhook)) {
        await API.addWebhook(webhook, ctx.prefs.controlPanel.selectedOrg!);
      } else {
        await API.updateWebhook(webhook, ctx.prefs.controlPanel.selectedOrg!);
      }
      setIsSending(false);
      props.onSuccess();
      onCloseForm();
    } catch (err) {
      setIsSending(false);
      if (err.statusText !== 'ErrLoginRedirect') {
        let error = `An error occurred ${isUndefined(props.webhook) ? 'adding' : 'updating'} the webhook`;
        switch (err.status) {
          case 400:
            error += `: ${err.statusText}`;
            break;
          default:
            error += ', please try again later';
        }
        setApiError(error);
        errorWrapper.current!.scrollIntoView({ behavior: 'smooth' });
      } else {
        props.onAuthError();
      }
    }
  }

  const submitForm = () => {
    if (form.current) {
      cleanApiError();
      const { isValid, webhook } = validateForm(form.current);
      if (isValid && !isNull(webhook)) {
        handleWebhook(webhook);
      }
    }
  };

  const validateForm = (form: HTMLFormElement): FormValidation => {
    let webhook: Webhook | null = null;
    const formData = new FormData(form);
    const isValid = form.checkValidity() && selectedPackages.length > 0;

    if (isValid) {
      webhook = {
        name: formData.get('name') as string,
        url: formData.get('url') as string,
        secret: formData.get('secret') as string,
        description: formData.get('description') as string,
        eventKinds: eventKinds,
        active: isActive,
        packages: selectedPackages,
      };

      if (payloadKind === PayloadKind.custom) {
        webhook = {
          ...webhook,
          template: formData.get('template') as string,
          contentType: contentType,
        };
      }

      if (props.webhook) {
        webhook = {
          ...webhook,
          webhookId: props.webhook.webhookId,
        };
      }
    }
    setIsValidated(true);
    return { isValid, webhook };
  };

  const addPackage = (packageItem: Package) => {
    const packagesList = [...selectedPackages];
    packagesList.push(packageItem);
    setSelectedPackages(packagesList);
  };

  const deletePackage = (packageId: string) => {
    const packagesList = selectedPackages.filter((item: Package) => item.packageId !== packageId);
    setSelectedPackages(packagesList);
  };

  const getPackagesIds = (): string[] => {
    return selectedPackages.map((item: Package) => item.packageId);
  };

  const updateEventKindList = (eventKind: EventKind) => {
    let updatedEventKinds: EventKind[] = [...eventKinds];
    if (eventKinds.includes(eventKind)) {
      // At least event kind must be selected
      if (updatedEventKinds.length > 1) {
        updatedEventKinds = eventKinds.filter((kind: EventKind) => kind !== eventKind);
      }
    } else {
      updatedEventKinds.push(eventKind);
    }
    setEventKinds(updatedEventKinds);
  };

  // Clean API error when form is focused after validation
  const cleanApiError = () => {
    if (!isNull(apiError)) {
      setApiError(null);
    }
  };

  return (
    <div>
      <div className="mb-5">
        {/* TODO */}
        <div className="mb-4 pb-2 border-bottom">
          <button
            data-testid="goBack"
            className={`btn btn-link text-dark btn-sm pl-0 d-flex align-items-center ${styles.link}`}
            onClick={onCloseForm}
          >
            <IoIosArrowBack className="mr-2" />
            Back to webhooks list
          </button>
        </div>

        <div className="mt-2">
          <form
            ref={form}
            data-testid="webhookForm"
            className={classnames('w-100', { 'needs-validation': !isValidated }, { 'was-validated': isValidated })}
            autoComplete="on"
            onFocus={cleanApiError}
            noValidate
          >
            <div className="form-row">
              <div className="col-md-8">
                <InputField
                  type="text"
                  label="Name"
                  labelLegend={<small className="ml-1 font-italic">(Required)</small>}
                  name="name"
                  value={!isUndefined(props.webhook) ? props.webhook.name : ''}
                  invalidText={{
                    default: 'This field is required',
                  }}
                  validateOnBlur
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="col-md-8">
                <InputField
                  type="text"
                  label="Description"
                  name="description"
                  value={!isUndefined(props.webhook) ? props.webhook.description : ''}
                />
              </div>
            </div>

            <div>
              <label className={`font-weight-bold ${styles.label}`} htmlFor="url">
                Url<small className="ml-1 font-italic">(Required)</small>
              </label>
              <div>
                <small className="form-text text-muted mb-2 mt-0">
                  A POST request will be sent to the provided URL when any of the events selected in the triggers
                  section happens.
                </small>
              </div>
              <div className="form-row">
                <div className="col-md-8">
                  <InputField
                    type="url"
                    name="url"
                    value={!isUndefined(props.webhook) ? props.webhook.url : ''}
                    invalidText={{
                      default: 'This field is required',
                      typeMismatch: 'Please enter a valid url',
                    }}
                    validateOnBlur
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={`font-weight-bold ${styles.label}`} htmlFor="secret">
                Secret
              </label>
              <div>
                <small className="form-text text-muted mb-2 mt-0">
                  If you provide a secret, we'll send it to you in the{' '}
                  <span className="font-weight-bold">X-ArtifactHub-Secret</span> header on each request. This will allow
                  you to validate that the request comes from ArtifactHub.
                </small>
              </div>
              <div className="form-row">
                <div className="col-md-8">
                  <InputField
                    type="text"
                    name="secret"
                    value={!isUndefined(props.webhook) ? props.webhook.secret : ''}
                  />
                </div>
              </div>
            </div>

            <div className="mb-3">
              <div className="custom-control custom-switch pl-0">
                <input
                  id="active"
                  type="checkbox"
                  className={`custom-control-input ${styles.checkbox}`}
                  value="true"
                  onChange={() => setIsActive(!isActive)}
                  checked={isActive}
                />
                <label
                  htmlFor="active"
                  className={`custom-control-label font-weight-bold ${styles.label} ${styles.customControlRightLabel}`}
                >
                  Active
                </label>
              </div>

              <small className="form-text text-muted mt-2">
                This flag indicates if the webhook is active or not. Inactive webhooks will not receive notifications.
              </small>
            </div>

            <div className="h4 pb-2 mt-5 mb-4 border-bottom">Triggers</div>

            <div className="my-4">
              <label className={`font-weight-bold ${styles.label}`} htmlFor="kind">
                Events
              </label>

              {SUBSCRIPTIONS_LIST.map((subs: SubscriptionItem) => {
                return (
                  <CheckBox
                    key={`check_${subs.kind}`}
                    name="eventKind"
                    value={subs.kind.toString()}
                    label={subs.title}
                    checked={eventKinds.includes(subs.kind)}
                    onChange={() => updateEventKindList(subs.kind)}
                    disabled
                  />
                );
              })}
            </div>

            <div className="mb-4">
              <label className={`font-weight-bold ${styles.label}`} htmlFor="packages">
                Packages<small className="ml-1 font-italic">(Required)</small>
              </label>
              <div>
                <small className="form-text text-muted mb-4 mt-0">
                  When the events selected happen for any of the packages you've chosen, a notification will be
                  triggered and the configured url will be called. At least one package must be selected.
                </small>
              </div>
              <div className="mb-3">
                <SearchTypeahead disabledPackages={getPackagesIds()} onSelection={addPackage} />
              </div>

              {isValidated && selectedPackages.length === 0 && (
                <div className="invalid-feedback mt-0 d-block">At least one package has to be selected</div>
              )}

              {selectedPackages.length > 0 && (
                <table className={`table table-hover table-sm ${styles.table}`}>
                  <thead>
                    <tr className={`table-primary ${styles.tableTitle}`}>
                      <th scope="col" className={`align-middle ${styles.fitCell}`}></th>
                      <th scope="col" className="align-middle w-50">
                        Package
                      </th>
                      <th scope="col" className="align-middle w-50">
                        Publisher
                      </th>
                      <th scope="col" className={`align-middle ${styles.fitCell}`}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPackages.map((item: Package) => (
                      <tr key={`subs_${item.packageId}`} data-testid="subsTableCell">
                        <td className="align-middle text-center">
                          <PackageIcon kind={item.kind} className={`${styles.icon} mx-2`} />
                        </td>
                        <td className="align-middle">
                          <div className="d-flex flex-row align-items-center">
                            <div
                              className={`d-flex align-items-center justify-content-center overflow-hidden p-1 ${styles.imageWrapper}`}
                            >
                              <Image
                                alt={item.displayName || item.name}
                                imageId={item.logoImageId}
                                className={styles.image}
                              />
                            </div>

                            <div className="ml-2 text-dark">{item.displayName || item.name}</div>
                          </div>
                        </td>
                        <td className="align-middle position-relative text-dark">
                          {item.userAlias || item.organizationDisplayName || item.organizationName}

                          {!isNull(item.chartRepository) && !isUndefined(item.chartRepository) && (
                            <small className="ml-2">
                              (<span className={`text-uppercase text-muted ${styles.legend}`}>Repo: </span>
                              <span className="text-dark">
                                {item.chartRepository!.displayName || item.chartRepository!.name}
                              </span>
                              )
                            </small>
                          )}
                        </td>

                        <td>
                          <button
                            className={`close text-danger mx-2 ${styles.closeBtn}`}
                            type="button"
                            onClick={() => deletePackage(item.packageId)}
                          >
                            <span aria-hidden="true">&times;</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="h4 pb-2 mt-5 mb-4 border-bottom">Payload</div>

            <div className="d-flex flex-row mb-3">
              {PAYLOAD_KINDS_LIST.map((item: PayloadKindsItem) => {
                return (
                  <div className="form-check mr-4" key={`payload_${item.kind}`}>
                    <input
                      className="form-check-input"
                      type="radio"
                      id={`payload_${item.kind}`}
                      name="payloadKind"
                      value="default"
                      checked={payloadKind === item.kind}
                      onChange={() => {
                        setPayloadKind(item.kind);
                        setIsValidated(false);
                        if (item.kind === PayloadKind.default && contentType !== '') {
                          contentTypeInput.current!.reset();
                          setTemplate(DEFAULT_PAYLOAD_TEMPLATE);
                        } else {
                          setTemplate('');
                        }
                      }}
                    />
                    <label className="form-check-label" htmlFor={`payload_${item.kind}`}>
                      {item.title}
                    </label>
                  </div>
                );
              })}
            </div>

            {payloadKind === PayloadKind.custom && (
              <small className="form-text text-muted mb-3">
                It's possible to customize the payload used to notify your service. This may help integrating
                ArtifactHub webhooks with other services without requiring you to write any code. To integrate
                ArtifactHub webhooks with Slack, for example, you could use a custom payload using the following
                template:
                <div className="my-3 w-100">
                  <div className={`alert alert-light text-nowrap ${styles.codeWrapper}`} role="alert">
                    {'{'}
                    <br />
                    <span className="ml-3">
                      {`"text": "Package`} <span className="font-weight-bold">{`{{ .Package.name }}`}</span> {`version`}{' '}
                      <span className="font-weight-bold">{`{{ .Package.version }}`}</span> released!{' '}
                      <span className="font-weight-bold">{`{{ .Package.url }}`}</span>
                      {`"`}
                      <br />
                      {'}'}
                    </span>
                  </div>
                </div>
              </small>
            )}

            <div className="form-row">
              <div className="col-md-8">
                <InputField
                  ref={contentTypeInput}
                  type="text"
                  label="Content type"
                  name="contentType"
                  value={contentType}
                  placeholder={payloadKind === PayloadKind.default ? 'application/cloudevents+json' : ''}
                  disabled={payloadKind === PayloadKind.default}
                  required={payloadKind !== PayloadKind.default}
                  invalidText={{
                    default: 'This field is required',
                  }}
                  onChange={onContentTypeChange}
                />
              </div>
            </div>

            <div className="form-group mb-4">
              <label className={`font-weight-bold ${styles.label}`} htmlFor="template">
                Template
              </label>

              {payloadKind === PayloadKind.custom && (
                <div>
                  <small className="form-text text-muted mb-4 mt-0">
                    Custom payloads are generated using{' '}
                    <ExternalLink href="https://golang.org/pkg/text/template/" className="font-weight-bold text-dark">
                      Go templates
                    </ExternalLink>
                    . Below you will find a list of the variables available for use in your template.
                  </small>
                </div>
              )}

              <AutoresizeTextarea
                name="template"
                value={template}
                disabled={payloadKind === PayloadKind.default}
                required={payloadKind !== PayloadKind.default}
                invalidText="This field is required"
                minRows={6}
              />
            </div>

            <div className="mb-3">
              <label className={`font-weight-bold ${styles.label}`} htmlFor="template">
                Variables reference
              </label>
              <small className="form-text text-muted">
                <table className={`table table-sm ${styles.variablesTable}`}>
                  <tbody>
                    <tr>
                      <th scope="row">
                        <span className="text-nowrap">{`{{ .Event.id }}`}</span>
                      </th>
                      <td>Id of the event triggering the notification.</td>
                    </tr>
                    <tr>
                      <th scope="row">
                        <span className="text-nowrap">{`{{ .Event.kind }}`}</span>
                      </th>
                      <td>
                        Kind of the event triggering notification. At the moment the only possible value is{' '}
                        <span className="font-weight-bold">package.new-release</span>.
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">
                        <span className="text-nowrap">{`{{ .Package.kind }}`}</span>
                      </th>
                      <td>
                        Kind of the package associated with the notification. Possible values are{' '}
                        <span className="font-weight-bold">helm-chart</span>,{' '}
                        <span className="font-weight-bold">falco-rules</span> and{' '}
                        <span className="font-weight-bold">opa-policies</span>.
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">
                        <span className="text-nowrap">{`{{ .Package.name }}`}</span>
                      </th>
                      <td>Name of the package.</td>
                    </tr>
                    <tr>
                      <th scope="row">
                        <span className="text-nowrap">{`{{ .Package.version }}`}</span>
                      </th>
                      <td>Version of the new release.</td>
                    </tr>
                    <tr>
                      <th scope="row">
                        <span className="text-nowrap">{`{{ .Package.publisher }}`}</span>
                      </th>
                      <td>
                        Publisher of the package in the format owner/repository on the case of Helm Charts and owner in
                        the rest.
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">
                        <span className="text-nowrap">{`{{ .Package.url }}`}</span>
                      </th>
                      <td>ArtifactHub URL of the package.</td>
                    </tr>
                  </tbody>
                </table>
              </small>
            </div>

            <div className="mt-5">
              <div className="d-flex flex-row justify-content-between">
                {!isNull(apiError) && (
                  <div className="alert alert-danger mr-5" role="alert" ref={errorWrapper}>
                    {apiError}
                  </div>
                )}

                <div className="ml-auto">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={isSending}
                    onClick={submitForm}
                    data-testid="updateProfileBtn"
                  >
                    {isSending ? (
                      <>
                        <span className="spinner-grow spinner-grow-sm" role="status" aria-hidden="true" />
                        <span className="ml-2">{isUndefined(props.webhook) ? 'Adding' : 'Updating'} webhook</span>
                      </>
                    ) : (
                      <>{isUndefined(props.webhook) ? 'Add' : 'Save'}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WebhookForm;