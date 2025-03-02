--create function  update_timestamp() before this
CREATE TRIGGER update_store_items_updated_at
BEFORE UPDATE ON store_items
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
    