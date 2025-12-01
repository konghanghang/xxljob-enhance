import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Typography,
  Checkbox,
  Card,
  Select,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { rolesApi, jobsApi } from '../api/services';
import type { RoleInfo, JobPermissionInfo, JobGroup } from '../types/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * Role Management Page Component
 * Admin-only page for managing roles and job permissions
 */

const RoleManagementPage: React.FC = () => {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [permissionsModalVisible, setPermissionsModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleInfo | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleInfo | null>(null);
  const [rolePermissions, setRolePermissions] = useState<JobPermissionInfo[]>([]);
  const [jobGroups, setJobGroups] = useState<JobGroup[]>([]);
  const [jobsByGroup, setJobsByGroup] = useState<Record<number, any[]>>({});
  const [form] = Form.useForm();
  const [permissionsForm] = Form.useForm();

  useEffect(() => {
    fetchRoles();
    fetchJobGroups();
  }, []);

  const fetchJobGroups = async () => {
    try {
      const response = await jobsApi.getGroups();
      setJobGroups(response.data);
    } catch (error: any) {
      message.error('Failed to load job groups: ' + (error.response?.data?.message || error.message));
    }
  };

  const fetchJobsForGroup = async (jobGroup: number) => {
    if (jobsByGroup[jobGroup]) {
      console.log(`Jobs for group ${jobGroup} already cached (${jobsByGroup[jobGroup].length} jobs)`);
      return; // Already loaded
    }

    try {
      console.log(`Fetching jobs for group ${jobGroup}...`);
      // Fetch all jobs for this group (use a large number to get all)
      const response = await jobsApi.getList({ jobGroup, start: 0, length: 10000 });
      console.log(`✅ Loaded ${response.data.data.length} jobs for group ${jobGroup}, total: ${response.data.recordsTotal}`);
      setJobsByGroup((prev) => {
        const updated = {
          ...prev,
          [jobGroup]: response.data.data,
        };
        console.log(`Updated jobsByGroup:`, Object.keys(updated).map(k => `${k}: ${updated[k].length} jobs`));
        return updated;
      });
    } catch (error: any) {
      message.error('Failed to load jobs: ' + (error.response?.data?.message || error.message));
    }
  };

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await rolesApi.getAll();
      setRoles(response.data);
    } catch (error: any) {
      message.error('Failed to load roles: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRole(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (role: RoleInfo) => {
    setEditingRole(role);
    form.setFieldsValue({
      name: role.name,
      description: role.description,
    });
    setModalVisible(true);
  };

  const handleManagePermissions = async (role: RoleInfo) => {
    setSelectedRole(role);
    try {
      const response = await rolesApi.getPermissions(role.id);
      setRolePermissions(response.data);

      // Pre-load jobs for all executors that have permissions
      const uniqueAppNames = [...new Set(response.data.map((p) => p.appName))];
      for (const appName of uniqueAppNames) {
        const group = jobGroups.find((g) => g.appname === appName);
        if (group) {
          await fetchJobsForGroup(group.id);
        }
      }

      setPermissionsModalVisible(true);
    } catch (error: any) {
      message.error('Failed to load permissions: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (editingRole) {
        await rolesApi.update(editingRole.id, values);
        message.success('Role updated successfully');
      } else {
        await rolesApi.create(values);
        message.success('Role created successfully');
      }

      setModalVisible(false);
      form.resetFields();
      fetchRoles();
    } catch (error: any) {
      if (error.response) {
        message.error('Operation failed: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handlePermissionsModalOk = async () => {
    if (!selectedRole) return;

    try {
      const values = await permissionsForm.validateFields();

      // Transform form values to permission array and ensure boolean fields have default values
      const permissions = (values.permissions || []).map((perm: any) => ({
        jobId: perm.jobId,
        appName: perm.appName,
        canView: perm.canView ?? false,
        canExecute: perm.canExecute ?? false,
        canEdit: perm.canEdit ?? false,
      }));

      await rolesApi.batchSetPermissions(selectedRole.id, { permissions });
      message.success('Permissions updated successfully');
      setPermissionsModalVisible(false);
      permissionsForm.resetFields();
    } catch (error: any) {
      if (error.response) {
        message.error('Failed to update permissions: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleDelete = async (role: RoleInfo) => {
    try {
      await rolesApi.remove(role.id);
      message.success('Role deleted successfully');
      fetchRoles();
    } catch (error: any) {
      message.error('Failed to delete role: ' + (error.response?.data?.message || error.message));
    }
  };

  const columns: ColumnsType<RoleInfo> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Role Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => desc || '-',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SafetyOutlined />}
            onClick={() => handleManagePermissions(record)}
          >
            Permissions
          </Button>
          <Popconfirm
            title="Delete this role?"
            onConfirm={() => handleDelete(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space
        style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Role Management
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
        >
          Create Role
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={roles}
        rowKey="id"
        loading={loading}
        pagination={{ showSizeChanger: true, showTotal: (total) => `Total ${total} roles` }}
      />

      <Modal
        title={editingRole ? 'Edit Role' : 'Create Role'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        okText={editingRole ? 'Update' : 'Create'}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Role Name"
            name="name"
            rules={[
              { required: true, message: 'Please input role name!' },
              { min: 2, message: 'Role name must be at least 2 characters' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Manage Permissions for ${selectedRole?.name}`}
        open={permissionsModalVisible}
        onOk={handlePermissionsModalOk}
        onCancel={() => {
          setPermissionsModalVisible(false);
          permissionsForm.resetFields();
        }}
        okText="Update"
        width={800}
      >
        <Form form={permissionsForm} layout="vertical">
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Configure job-level permissions for this role. You can grant view, execute, or edit permissions for specific jobs.
          </Text>

          <Form.List name="permissions" initialValue={rolePermissions}>
            {(fields, { add, remove }) => (
              <div>
                <Button
                  type="dashed"
                  onClick={() => add({
                    canView: false,
                    canExecute: false,
                    canEdit: false
                  })}
                  block
                  icon={<PlusOutlined />}
                  style={{ marginBottom: 16 }}
                >
                  Add Job Permission
                </Button>

                {fields.map(({ key, name, ...restField }) => (
                    <Card
                      key={key}
                      size="small"
                      style={{ marginBottom: 12 }}
                      extra={
                        <Button
                          type="link"
                          danger
                          size="small"
                          onClick={() => remove(name)}
                        >
                          Remove
                        </Button>
                      }
                    >
                      <Space style={{ width: '100%' }} direction="vertical">
                        <Space style={{ width: '100%' }}>
                          <Form.Item
                            {...restField}
                            name={[name, 'appName']}
                            rules={[{ required: true, message: 'Select executor' }]}
                            style={{ marginBottom: 0, width: 200 }}
                            label="Executor (App)"
                          >
                            <Select
                              placeholder="Select executor"
                              showSearch
                              optionFilterProp="label"
                              dropdownStyle={{ minWidth: 400 }}
                              onChange={async (appName) => {
                                const group = jobGroups.find((g) => g.appname === appName);
                                if (group) {
                                  // Clear job selection first
                                  permissionsForm.setFieldValue(['permissions', name, 'jobId'], undefined);
                                  // Then fetch jobs (wait for completion to ensure state is updated)
                                  await fetchJobsForGroup(group.id);
                                }
                              }}
                              options={jobGroups.map((group) => ({
                                label: `${group.title} (${group.appname})`,
                                value: group.appname,
                              }))}
                            />
                          </Form.Item>

                          <Form.Item
                            noStyle
                            shouldUpdate={(prevValues, currentValues) =>
                              prevValues.permissions?.[name]?.appName !== currentValues.permissions?.[name]?.appName
                            }
                          >
                            {() => {
                              const currentAppName = permissionsForm.getFieldValue(['permissions', name, 'appName']);
                              const currentJobGroup = jobGroups.find((g) => g.appname === currentAppName);
                              const availableJobs = currentJobGroup ? jobsByGroup[currentJobGroup.id] || [] : [];

                              console.log(`Rendering job select for item ${name}: appName=${currentAppName}, availableJobs=${availableJobs.length}`);

                              return (
                                <Form.Item
                                  {...restField}
                                  name={[name, 'jobId']}
                                  rules={[{ required: true, message: 'Select job' }]}
                                  style={{ marginBottom: 0, flex: 1 }}
                                  label="Job"
                                >
                                  <Select
                                    placeholder={availableJobs.length > 0 ? `Select job (${availableJobs.length} available)` : 'Select job'}
                                    showSearch
                                    optionFilterProp="label"
                                    disabled={!currentAppName}
                                    dropdownStyle={{ minWidth: 500 }}
                                    virtual={true}
                                    listHeight={400}
                                    options={availableJobs.map((job) => ({
                                      label: `#${job.id} - ${job.jobDesc}`,
                                      value: job.id,
                                    }))}
                                  />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        </Space>

                        <Space>
                          <Form.Item
                            {...restField}
                            name={[name, 'canView']}
                            valuePropName="checked"
                            style={{ marginBottom: 0 }}
                          >
                            <Checkbox>Can View</Checkbox>
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, 'canExecute']}
                            valuePropName="checked"
                            style={{ marginBottom: 0 }}
                          >
                            <Checkbox>Can Execute</Checkbox>
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, 'canEdit']}
                            valuePropName="checked"
                            style={{ marginBottom: 0 }}
                          >
                            <Checkbox>Can Edit</Checkbox>
                          </Form.Item>
                        </Space>
                      </Space>
                    </Card>
                ))}
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
};

export default RoleManagementPage;
