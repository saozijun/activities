export function getCategories() {
    return useGet('/activity/categories');
}

export function saveCategory(params) {
    return usePost('/activity-categories/save', params);
}

export function deleteCategory(id) {
    return usePost('/activity-categories/delete', { id });
} 